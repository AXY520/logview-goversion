# 日志查看器 - Go版本 (Log Viewer - Go Version)

一个基于Gin框架的Go语言Web应用程序，用于查看和管理日志文件。这是原Python版本的Go语言重构版本。

## 功能特性

- 从远程服务器下载日志文件
- 浏览日志文件结构
- 查看日志文件内容
- 支持多种文件格式（JSON, XML, HTML, TXT等）
- 语法高亮显示
- 响应式设计，支持移动设备
- 高性能的Go语言实现

## 技术栈

- 后端: Gin (Go)
- 前端: HTML, CSS, JavaScript
- 数据库: SQLite
- 样式库: Font Awesome

## 环境要求

- Go 1.23.0 或更高版本
- SQLite3

## 安装和运行

### 1. 克隆项目

```bash
git clone <repository-url>
cd logView/logview-goversion
```

### 2. 使用脚本运行（推荐）

```bash
# 一键构建并运行
./run.sh
```

### 3. 手动构建和运行

```bash
# 下载依赖
go mod tidy

# 构建应用
go build -o logview-server .

# 运行应用
./logview-server
```

### 4. 自定义端口

```bash
# 设置端口并运行
PORT=8080 ./run.sh
```

应用将在指定端口上运行（默认5000）：
- http://localhost:5000

## 使用说明

1. 打开浏览器访问 `http://localhost:5000`
2. 点击"下载日志"按钮查看远程日志列表
3. 选择日志ID或手动输入日志ID进行下载
4. 在日志列表中选择一个日志
5. 浏览文件结构并点击文件查看内容

## API接口

### 获取本地日志列表
```
GET /api/logs
```

### 获取远程日志列表
```
GET /api/remote-logs
```

### 下载日志
```
POST /api/download
Body: { "log_id": "日志ID" }
```

### 获取日志文件结构
```
GET /api/logs/<log_id>/files
```

### 获取文件内容
```
GET /api/logs/<log_id>/file?path=文件路径
```

### 删除日志
```
DELETE /api/logs/<log_id>
```

## 项目结构

```
logview-goversion/
├── main.go              # Gin应用主文件
├── controllers/         # 控制器层
│   └── logs.go         # 日志相关控制器
├── database/           # 数据库层
│   └── db.go          # SQLite数据库操作
├── utils/             # 工具类
│   └── log_processor.go # 日志处理类
├── templates/         # HTML模板
│   ├── index.html     # 主页面
│   ├── log_list.html  # 日志列表组件
│   ├── file_tree.html # 文件树组件
│   └── file_content.html # 文件内容组件
├── static/            # 静态资源
│   ├── css/          # 样式文件
│   └── js/           # JavaScript文件
├── storage/          # 存储目录
│   ├── zips/        # ZIP文件存储
│   └── extracted/   # 解压文件存储
├── build.sh         # 构建脚本
├── run.sh           # 运行脚本
├── go.mod           # Go模块文件
├── go.sum           # 依赖校验文件
└── README.md        # 说明文档
```

## 与Python版本的对比

### 性能优势
- **并发性能**: Go语言的goroutine提供更好的并发处理能力
- **内存效率**: 更低的内存占用和更快的垃圾回收
- **编译型语言**: 无需运行时解释，执行速度更快

### 部署优势
- **单文件部署**: 编译后生成单个可执行文件，无需依赖管理
- **交叉编译**: 轻松编译到不同平台（Linux, Windows, macOS）
- **容器化**: 更小的Docker镜像体积

### 代码优势
- **静态类型**: 编译时类型检查，减少运行时错误
- **简洁语法**: 更少的代码量实现相同功能
- **标准库**: 丰富的标准库，减少外部依赖

## 开发

### 代码结构

- `main.go`: Gin应用入口，定义路由和中间件
- `controllers/`: HTTP请求处理器，实现API逻辑
- `database/`: SQLite数据库操作，封装数据访问层
- `utils/`: 业务逻辑处理，包括日志下载、解压和文件处理
- `templates/`: HTML模板文件，使用Gin模板语法
- `static/`: 前端静态资源文件

### 扩展功能

1. **添加新的文件类型支持**: 在 `utils/log_processor.go` 的 `detectFileType` 方法中添加新的文件类型检测
2. **添加语法高亮**: 在 `static/js/script.js` 的 `applySyntaxHighlighting` 函数中添加新的语法高亮规则
3. **添加搜索功能**: 在前端JavaScript中实现搜索逻辑

### 构建

```bash
# 开发模式构建
go build -o logview-server .

# 生产模式构建（启用优化）
go build -ldflags "-s -w" -o logview-server .

# 交叉编译
GOOS=linux GOARCH=amd64 go build -o logview-server-linux .
GOOS=windows GOARCH=amd64 go build -o logview-server.exe .
```

## 许可证

MIT License