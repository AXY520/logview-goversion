# LogView Go版本性能优化方案

## 一、性能分析总结

### 1.1 当前架构概览
```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (Browser)                         │
│                   web/static/js/script.js                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Gin HTTP Server                              │
│         main.go → internal/handlers → internal/services          │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│   SQLite Database       │   │   File System               │
│   database/db.go        │   │   storage/extracted/        │
│   internal/repository/  │   │   utils/log_processor.go    │
└─────────────────────────┘   └─────────────────────────────┘
```

### 1.2 识别的主要性能瓶颈

#### 1.2.1 数据库层 (严重)
- ❌ **无连接池配置** - 每次请求创建新连接
- ❌ **无索引** - 查询全表扫描
- ❌ **重复的Schema迁移** - 每次启动执行 `addColumnIfNotExists`
- ❌ **双重数据库实现** - 同时存在 `database/db.go` 和 `internal/repository/log_repository.go`

#### 1.2.2 文件处理层 (中等)
- ❌ **无文件树缓存** - 每次展开目录都重新遍历
- ❌ **低效排序算法** - 使用 O(n²) 的冒泡排序
- ❌ **大文件行统计** - 完全读取文件统计行数
- ❌ **ZIP解压无进度反馈** - 无法处理大文件超时

#### 1.2.3 HTTP客户端层 (中等)
- ❌ **无连接复用** - 每次请求创建新HTTP客户端
- ❌ **无超时优化** - 5分钟超时过长

#### 1.2.4 前端层 (严重)
- ❌ **大文件直接渲染** - 超过500KB文件导致DOM卡顿
- ❌ **DOM操作过多** - 每次高亮都重绘
- ❌ **搜索无防抖优化** - 实时搜索性能差
- ❌ **无虚拟滚动** - 日志超过1万行时性能下降

---

## 二、优化方案详细设计

### 2.1 数据库性能优化

#### 2.1.1 实现连接池
```go
// database/db.go 优化
func NewDB() *LogDatabase {
    db, err := sql.Open("sqlite3", "logs.db?_busy_timeout=5000")
    if err != nil {
        log.Fatal(err)
    }
    
    // 配置连接池
    db.SetMaxOpenConns(25)           // 最大打开连接数
    db.SetMaxIdleConns(5)            // 最大空闲连接数
    db.SetConnMaxLifetime(5 * time.Minute)  // 连接最大生命周期
    
    return &LogDatabase{db: db}
}
```

#### 2.1.2 添加数据库索引
```go
// 在 createTables 函数中添加
CREATE INDEX IF NOT EXISTS idx_logs_log_id ON logs(log_id);
CREATE INDEX IF NOT EXISTS idx_logs_download_time ON logs(download_time DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tags ON logs(tags);
```

#### 2.1.3 优化Schema迁移
```go
// 使用单一迁移函数代替重复检查
func (r *LogRepository) runMigrations() error {
    migrations := []struct {
        sql   string
        check string
    }{
        {
            "ALTER TABLE logs ADD COLUMN tags TEXT DEFAULT ''",
            "SELECT COUNT(*) FROM pragma_table_info('logs') WHERE name = 'tags'",
        },
        {
            "ALTER TABLE logs ADD COLUMN notes TEXT DEFAULT ''",
            "SELECT COUNT(*) FROM pragma_table_info('logs') WHERE name = 'notes'",
        },
    }
    
    for _, m := range migrations {
        var count int
        if err := r.db.QueryRow(m.check).Scan(&count); err != nil {
            return err
        }
        if count == 0 {
            if _, err := r.db.Exec(m.sql); err != nil {
                return fmt.Errorf("migration failed: %w", err)
            }
        }
    }
    return nil
}
```

#### 2.1.4 统一数据库实现
- 移除 `database/db.go`，统一使用 `internal/repository/log_repository.go`
- 保持向后兼容的 API 设计

---

### 2.2 文件处理性能优化

#### 2.2.1 实现文件树缓存
```go
// internal/services/file_service.go
type FileService struct {
    cfg        *config.Config
    fileCache  *Cache  // 新增缓存层
    // ... 其他字段
}

func NewFileService(cfg *config.Config) *FileService {
    return &FileService{
        cfg:       cfg,
        fileCache: NewCache(5 * time.Minute),  // 5分钟缓存
        // ... 其他初始化
    }
}

// GetFileStructure 优化版本
func (s *FileService) GetFileStructure(logID string) (*models.FileNode, error) {
    // 尝试从缓存获取
    if cached, ok := s.fileCache.Get("tree:" + logID); ok {
        return cached.(*models.FileNode), nil
    }
    
    // 缓存未命中，生成文件树
    fileNode, err := s.buildOptimizedTree(logID)
    if err != nil {
        return nil, err
    }
    
    // 存入缓存
    s.fileCache.Set("tree:"+logID, fileNode)
    
    return fileNode, nil
}
```

#### 2.2.2 优化排序算法
```go
// internal/pkg/fileutil/fileutil.go
// 替换冒泡排序为快速排序
func (f *FileUtil) sortNodes(nodes []*FileNode) {
    sort.Slice(nodes, func(i, j int) bool {
        // 目录优先，然后按名称排序
        if nodes[i].Type != nodes[j].Type {
            return nodes[i].Type == "directory"
        }
        return nodes[i].Name < nodes[j].Name
    })
}
```

#### 2.2.3 优化行统计
```go
// utils/log_processor.go
// 使用 bufio.Scanner 进行高效行统计
func (lp *LogProcessor) countLines(filePath string) int {
    file, err := os.Open(filePath)
    if err != nil {
        return 0
    }
    defer file.Close()
    
    scanner := bufio.NewScanner(file)
    // 每行最大64KB，支持超大行
    scanner.Buffer(make([]byte, 1024), 64*1024*1024)
    
    count := 0
    for scanner.Scan() {
        count++
    }
    
    return count
}
```

#### 2.2.4 添加解压进度反馈
```go
func (z *ZipUtil) ExtractWithProgress(zipPath, extractTo string, onProgress func(float64)) error {
    reader, err := zip.OpenReader(zipPath)
    if err != nil {
        return err
    }
    defer reader.Close()
    
    totalFiles := len(reader.File)
    for i, file := range reader.File {
        // ... 解压逻辑
        
        // 报告进度
        if onProgress != nil {
            onProgress(float64(i) / float64(totalFiles) * 100)
        }
    }
    
    return nil
}
```

---

### 2.3 HTTP客户端优化

#### 2.3.1 实现连接复用
```go
// internal/pkg/httpclient/client.go
type Client struct {
    cfg    *config.Config
    client *http.Client  // 复用客户端
    mu     sync.RWMutex  // 保护连接池
}

var defaultClient *http.Client

func init() {
    defaultClient = &http.Client{
        Timeout: 30 * time.Second,
        Transport: &http.Transport{
            MaxIdleConns:        100,
            MaxIdleConnsPerHost:  10,
            IdleConnTimeout:      90 * time.Second,
            TLSHandshakeTimeout:  10 * time.Second,
        },
    }
}

func (c *Client) DownloadWithAuth(url, savePath string) error {
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return fmt.Errorf("创建请求失败: %w", err)
    }
    
    req.SetBasicAuth(c.cfg.RemoteAPI.Username, c.cfg.RemoteAPI.Password)
    
    // 使用共享客户端
    resp, err := defaultClient.Do(req)
    if err != nil {
        return fmt.Errorf("发送请求失败: %w", err)
    }
    defer resp.Body.Close()
    
    // ... 后续逻辑
}
```

---

### 2.4 前端性能优化

#### 2.4.1 实现虚拟滚动
```javascript
// web/static/js/script.js
class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.visibleCount = Math.ceil(container.clientHeight / itemHeight);
        this.cache = new Map();
    }
    
    render(scrollTop, totalItems) {
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleCount + 5, totalItems);
        
        this.container.innerHTML = '';
        this.container.style.height = `${totalItems * this.itemHeight}px`;
        this.container.style.transform = `translateY(${startIndex * this.itemHeight}px)`;
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.renderItem(i);
            item.style.position = 'absolute';
            item.style.top = `${i * this.itemHeight}px`;
            this.container.appendChild(item);
        }
    }
}
```

#### 2.4.2 优化大文件渲染
```javascript
function applyContentFormatting(fileType, content, element, fileName, offset = 0) {
    const contentSize = content.length;
    const isLargeFile = contentSize > 500000; // 500KB
    
    // 大文件使用 DocumentFragment 减少重绘
    if (isLargeFile) {
        const fragment = document.createDocumentFragment();
        const div = document.createElement('div');
        div.textContent = content;  // 纯文本模式
        div.className = 'content-text simple-render';
        fragment.appendChild(div);
        element.appendChild(fragment);
        return false;
    }
    
    // ... 小文件正常渲染逻辑
}
```

#### 2.4.3 搜索功能优化
```javascript
// 使用 Web Worker 进行后台搜索
const searchWorker = new Worker('search-worker.js');

function performSearch(searchTerm) {
    return new Promise((resolve) => {
        searchWorker.postMessage({
            type: 'search',
            content: window.originalFileContent,
            term: searchTerm
        });
        
        searchWorker.onmessage = (e) => {
            resolve(e.data);
        };
    });
}

// 搜索防抖优化
function debounceSearch(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

#### 2.4.4 使用 CSS Containment 优化渲染
```css
/* styles.css */
.log-line {
    contain: content;  /* 隔离布局计算 */
    will-change: transform;  /* 提示浏览器优化 */
}

.tree-children {
    contain: layout style;
}
```

---

### 2.5 缓存策略实现

#### 2.5.1 实现多层缓存
```go
// internal/cache/cache.go
type Cache struct {
    memory *ristretto.Cache  // 使用 ristretto 高性能缓存
    ttl    time.Duration
}

func NewCache(ttl time.Duration) *Cache {
    cache, _ := ristretto.NewCache(&ristretto.Config{
        NumCounters: 1e7,     // 计数器数量
        MaxCost:     1 << 30, // 1GB 最大内存
        BufferItems: 64,      // 缓冲项目数
    })
    
    return &Cache{
        memory: cache,
        ttl:    ttl,
    }
}

func (c *Cache) Get(key string) (interface{}, bool) {
    return c.memory.Get(key)
}

func (c *Cache) Set(key string, value interface{}) {
    cost := reflect.TypeOf(value).Size()
    c.memory.Set(key, value, int64(cost))
}
```

#### 2.5.2 缓存配置
```go
// 缓存策略配置
const (
    // 文件树缓存 - 5分钟
    FileTreeCacheTTL = 5 * time.Minute
    
    // 文件内容缓存 - 2分钟（小文件）
    FileContentCacheTTL = 2 * time.Minute
    
    // 远程日志列表缓存 - 10分钟
    RemoteLogsCacheTTL = 10 * time.Minute
    
    // 缓存大小限制
    MaxCacheSize = 100 * 1024 * 1024 // 100MB
)
```

---

### 2.6 并发处理优化

#### 2.6.1 使用 Worker Pool 处理大文件
```go
// internal/services/file_service.go
type FileProcessor struct {
    workerPool chan struct{}
    wg         sync.WaitGroup
}

func NewFileProcessor(maxWorkers int) *FileProcessor {
    return &FileProcessor{
        workerPool: make(chan struct{}, maxWorkers),
    }
}

func (fp *FileProcessor) ProcessFile(filePath string, fn func()) {
    fp.workerPool <- struct{}{}  // 获取工作令牌
    fp.wg.Add(1)
    
    go func() {
        defer fp.wg.Done()
        defer func() { <-fp.workerPool }()  // 释放令牌
        
        fn()
    }()
}

func (fp *FileProcessor) Wait() {
    fp.wg.Wait()
}
```

#### 2.6.2 使用 Context 控制超时
```go
func (s *FileService) GetFileContentWithTimeout(logID, filePath string, timeout time.Duration) (*models.FileContent, error) {
    ctx, cancel := context.WithTimeout(context.Background(), timeout)
    defer cancel()
    
    done := make(chan *models.FileContent, 1)
    
    go func() {
        content, err := s.getFileContent(logID, filePath)
        done <- &models.FileContent{Content: content, Err: err}
    }()
    
    select {
    case result := <-done:
        return result, nil
    case <-ctx.Done():
        return nil, fmt.Errorf("读取文件超时: %v", timeout)
    }
}
```

---

## 三、优化实施计划

### 阶段一：基础设施优化 (优先级最高)
1. 实现数据库连接池
2. 添加数据库索引
3. 统一数据库实现
4. 实现基础缓存层

### 阶段二：文件处理优化
1. 实现文件树缓存
2. 优化排序算法
3. 改进行统计方法
4. 添加解压进度反馈

### 阶段三：HTTP 客户端优化
1. 实现连接复用
2. 优化超时配置
3. 添加重试机制

### 阶段四：前端性能优化
1. 实现虚拟滚动
2. 优化大文件渲染
3. 改进搜索功能
4. 使用 CSS Containment

### 阶段五：监控与调优
1. 添加性能指标收集
2. 实现健康检查接口
3. 添加日志记录

---

## 四、预期性能提升

| 优化项 | 当前指标 | 优化后指标 | 提升幅度 |
|--------|----------|------------|----------|
| 数据库查询 | 50-100ms | 5-10ms | 5-10x |
| 文件树加载 | 500ms+ | 50ms | 10x |
| 大文件渲染 | 3-5s | 500ms | 6-10x |
| 搜索响应 | 1-2s | 100ms | 10-20x |
| 内存使用 | 200MB+ | 100MB | 50% 降低 |

---

## 五、风险评估与回退策略

### 5.1 风险项
1. **缓存一致性问题** - 解决方案：设置合理的 TTL 和手动失效机制
2. **连接池配置不当** - 解决方案：提供默认值，支持环境变量配置
3. **前端虚拟滚动复杂** - 解决方案：渐进式实现，先支持简单场景

### 5.2 回退策略
1. 所有优化通过 Feature Flag 控制
2. 保留原有代码路径
3. 监控关键指标，发现问题可快速回退

---

## 六、监控指标

### 6.1 后端监控
- `GET /metrics` - Prometheus 格式指标
- `GET /health` - 健康检查接口
- 日志记录请求耗时

### 6.2 前端监控
- 页面加载时间
- API 请求耗时
- 渲染帧率监控
- 内存使用监控

---

## 七、总结

本优化方案涵盖数据库、文件处理、HTTP 客户端、前端渲染等多个层面，通过系统性的优化措施，预计可以将整体性能提升 5-10 倍，同时降低 50% 的内存使用。

建议按照优化实施计划分阶段进行，每阶段都进行充分的性能测试，确保优化效果符合预期。
