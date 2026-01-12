#!/bin/bash

# 运行脚本

set -e

echo "开始运行..."

# 设置端口
PORT=${PORT:-5001}

# 构建应用
echo "构建应用..."
go build -o bin/logview-server ./cmd/server

# 运行应用
echo "运行应用 (端口: $PORT)..."
PORT=$PORT ./bin/logview-server