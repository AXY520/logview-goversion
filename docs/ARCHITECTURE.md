# 项目架构说明

## 优化后的目录结构

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
├── docs/               # 文档
│   └── ARCHITECTURE.md # 架构说明
├── go.mod             # Go模块文件
├── go.sum             # 依赖校验文件
├── .gitignore         # Git忽略文件
└── README.md          # 说明文档
```

## 架构设计原则

### 1. 分层架构

项目采用经典的分层架构设计，各层职责清晰：

| 层级 | 目录 | 职责 |
|------|------|------|
| Handler层 | `internal/handlers/` | 处理HTTP请求和响应，参数验证 |
| Service层 | `internal/services/` | 实现业务逻辑，协调各组件 |
| Repository层 | `internal/repository/` | 数据访问和持久化 |
| Model层 | `internal/models/` | 数据模型定义 |
| Config层 | `internal/config/` | 配置管理 |
| Middleware层 | `internal/middleware/` | 中间件处理 |
| Pkg层 | `internal/pkg/` | 可复用的工具包 |

### 2. 依赖注入

通过构造函数注入依赖，便于测试和维护：

```go
// 示例：创建日志服务
logService := services.NewLogService(logRepo)

// 示例：创建日志处理器
logHandler := handlers.NewLogHandler(logService, fileService)
```

### 3. 单一职责

每个模块只负责一个功能领域：

- `log_service.go` - 日志相关业务逻辑
- `file_service.go` - 文件处理业务逻辑
- `remote_service.go` - 远程API调用
- `device_service.go` - 设备检测

### 4. 配置管理

所有配置集中管理，支持环境变量覆盖：

```go
cfg := config.Load()
```

## 数据流向

```
HTTP请求
    ↓
Middleware (CORS, Logger, Recovery)
    ↓
Handler (参数验证、响应格式化)
    ↓
Service (业务逻辑)
    ↓
Repository (数据访问)
    ↓
Database
```

## 模块说明

### Config模块

负责加载和管理应用配置，支持环境变量覆盖。

### Models模块

定义所有数据模型，包括：
- `Log` - 日志模型
- `RemoteLog` - 远程日志模型
- `FileNode` - 文件节点模型
- `FileContent` - 文件内容模型
- 各种请求/响应模型

### Handlers模块

HTTP请求处理器，负责：
- 参数验证
- 调用Service层
- 格式化响应

### Services模块

业务逻辑层，负责：
- 实现核心业务逻辑
- 协调各组件
- 数据转换

### Repository模块

数据访问层，负责：
- 数据库操作
- 数据持久化
- SQL查询

### Middleware模块

中间件，负责：
- CORS处理
- 日志记录
- 异常恢复

### Pkg模块

工具包，提供可复用的功能：
- `httpclient` - HTTP客户端
- `fileutil` - 文件工具
- `ziputil` - ZIP工具

## 优化对比

### 优化前

```
logview-goversion/
├── main.go              # 所有代码混在一起
├── controllers/         # 控制器
├── database/           # 数据库
├── utils/             # 工具类（混杂）
├── templates/         # 模板
├── static/            # 静态资源
└── storage/           # 存储
```

### 优化后

```
logview-goversion/
├── cmd/server/        # 入口分离
├── internal/          # 内部代码
│   ├── config/       # 配置独立
│   ├── models/       # 模型独立
│   ├── handlers/     # 处理器独立
│   ├── services/     # 服务层独立
│   ├── repository/   # 数据访问独立
│   ├── middleware/   # 中间件独立
│   └── pkg/         # 工具包分类
├── web/             # Web资源统一
├── scripts/         # 脚本统一
└── docs/            # 文档独立
```

## 优势

1. **清晰的职责划分** - 每个模块职责明确
2. **易于测试** - 依赖注入便于单元测试
3. **易于维护** - 代码组织清晰，修改影响范围小
4. **易于扩展** - 新增功能只需添加对应模块
5. **符合Go最佳实践** - 遵循Go项目标准布局