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
- 日志标签和备注管理
- 设备在线检测

## 技术栈

- 后端: Gin (Go)
- 前端: HTML, CSS, JavaScript
- 数据库: SQLite
- 样式库: Font Awesome

## 环境要求

- Go 1.23.0 或更高版本
- SQLite3

## 项目结构

```
logview-goversion/
├── cmd/                    # 应用入口
│   └── server/
│       └── main.go        # 主程序入口
├── internal/              # 内部代码（不对外暴露）
│   ├── config/           # 配置管理
│   │   └── config.go     # 配置定义和加载
│   ├── models/           # 数据模型
│   │   ├── log.go        # 日志相关模型
│   │   └── error.go      # 错误响应模型
│   ├── handlers/         # HTTP处理器
│   │   ├── log_handler.go      # 日志处理器
│   │   ├── remote_handler.go   # 远程日志处理器
│   │   └── device_handler.go   # 设备处理器
│   ├── services/         # 业务逻辑层
│   │   ├── log_service.go      # 日志服务
│   │   ├── remote_service.go   # 远程服务
│   │   ├── file_service.go     # 文件服务
│   │   └── device_service.go   # 设备服务
│   ├── repository/       # 数据访问层
│   │   └── log_repository.go   # 日志数据访问
│   ├── middleware/       # 中间件
│   │   ├── cors.go       # 跨域中间件
│   │   ├── logger.go     # 日志中间件
│   │   └── recovery.go   # 恢复中间件
│   └── pkg/             # 工具包
│       ├── httpclient/   # HTTP客户端
│       │   └── client.go
│       ├── fileutil/     # 文件工具
│       │   └── fileutil.go
│       └── ziputil/      # ZIP工具
│           └── ziputil.go
├── web/                  # Web资源
│   ├── static/          # 静态资源
│   │   ├── css/         # 样式文件
│   │   └── js/          # JavaScript文件
│   └── templates/       # HTML模板
│       ├── index.html
│       ├── log_list.html
│       ├── file_tree.html
│       └── file_content.html
├── scripts/             # 脚本
│   ├── build.sh        # 构建脚本
│   └── run.sh          # 运行脚本
├── storage/            # 存储目录
│   ├── zips/          # ZIP文件存储
│   └── extracted/     # 解压文件存储
├── go.mod             # Go模块文件
├── go.sum             # 依赖校验文件
└── README.md          # 说明文档
```

## 安装和运行

### 1. 克隆项目

```bash
git clone <repository-url>
cd logview-goversion
```

### 2. 使用脚本运行（推荐）

```bash
# 一键构建并运行
./scripts/run.sh
```

### 3. 手动构建和运行

```bash
# 下载依赖
go mod tidy

# 构建应用
go build -o bin/logview-server ./cmd/server

# 运行应用
./bin/logview-server
```

### 4. 自定义端口

```bash
# 设置端口并运行
PORT=8080 ./scripts/run.sh
```

应用将在指定端口上运行（默认5001）：
- http://localhost:5001

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 5001 |
| GIN_MODE | Gin运行模式 | release |
| DB_PATH | 数据库路径 | logs.db |
| STORAGE_BASE_DIR | 存储基础目录 | . |
| STORAGE_ZIP_DIR | ZIP文件目录 | storage/zips |
| STORAGE_EXTRACT_DIR | 解压文件目录 | storage/extracted |
| MAX_FILE_SIZE | 最大文件大小（字节） | 10485760 (10MB) |
| MAX_PREVIEW_SIZE | 预览大小（字节） | 512000 (500KB) |
| REMOTE_API_URL | 远程API地址 | https://hlogs.lazycat.cloud/api/v1 |
| REMOTE_API_USERNAME | 远程API用户名 | lnks |
| REMOTE_API_PASSWORD | 远程API密码 | N5JKpyiw97zhrY0U |
| REMOTE_API_TIMEOUT | 远程API超时（秒） | 300 |

## 使用说明

1. 打开浏览器访问 `http://localhost:5001`
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

### 更新日志标签
```
PUT /api/logs/<log_id>/tags
Body: { "tags": "标签" }
```

### 更新日志备注
```
PUT /api/logs/<log_id>/notes
Body: { "notes": "备注" }
```

### 更新日志元数据
```
PUT /api/logs/<log_id>/metadata
Body: { "tags": "标签", "notes": "备注" }
```

### 设备检测
```
POST /api/device-check
Body: { "device_name": "设备名称" }
```

## 架构说明

### 分层架构

项目采用经典的分层架构设计：

1. **Handler层** (`internal/handlers/`): 处理HTTP请求和响应
2. **Service层** (`internal/services/`): 实现业务逻辑
3. **Repository层** (`internal/repository/`): 数据访问和持久化
4. **Model层** (`internal/models/`): 数据模型定义
5. **Config层** (`internal/config/`): 配置管理
6. **Middleware层** (`internal/middleware/`): 中间件处理
7. **Pkg层** (`internal/pkg/`): 可复用的工具包

### 依赖注入

通过构造函数注入依赖，便于测试和维护：

```go
// 示例：创建日志服务
logService := services.NewLogService(logRepo)

// 示例：创建日志处理器
logHandler := handlers.NewLogHandler(logService, fileService)
```

## 开发

### 代码结构

- `cmd/server/main.go`: 应用入口，初始化所有组件并启动服务器
- `internal/handlers/`: HTTP请求处理器，实现API逻辑
- `internal/services/`: 业务逻辑处理
- `internal/repository/`: 数据库操作，封装数据访问层
- `internal/models/`: 数据模型定义
- `internal/config/`: 配置管理
- `internal/middleware/`: 中间件
- `internal/pkg/`: 工具类
- `web/`: 前端静态资源文件

### 扩展功能

1. **添加新的文件类型支持**: 在 `internal/pkg/fileutil/fileutil.go` 的 `DetectFileType` 方法中添加新的文件类型检测
2. **添加语法高亮**: 在 `web/static/js/script.js` 中添加新的语法高亮规则
3. **添加搜索功能**: 在前端JavaScript中实现搜索逻辑

### 构建

```bash
# 开发模式构建
go build -o bin/logview-server ./cmd/server

# 生产模式构建（启用优化）
go build -ldflags "-s -w" -o bin/logview-server ./cmd/server

# 使用构建脚本
./scripts/build.sh

# 交叉编译
GOOS=linux GOARCH=amd64 go build -o bin/logview-server-linux ./cmd/server
GOOS=windows GOARCH=amd64 go build -o bin/logview-server.exe ./cmd/server
GOOS=darwin GOARCH=amd64 go build -o bin/logview-server-mac ./cmd/server
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

## 许可证

MIT License