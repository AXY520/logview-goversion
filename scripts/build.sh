#!/bin/bash

# 构建脚本

set -e

echo "开始构建..."

# 设置构建变量
APP_NAME="logview-server"
BUILD_DIR="bin"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')

# 创建构建目录
mkdir -p $BUILD_DIR

# 构建参数
LDFLAGS="-X main.Version=$VERSION -X main.BuildTime=$BUILD_TIME -s -w"

# 构建应用
echo "构建 $APP_NAME..."
go build -ldflags "$LDFLAGS" -o $BUILD_DIR/$APP_NAME ./cmd/server

echo "构建完成: $BUILD_DIR/$APP_NAME"
echo "版本: $VERSION"
echo "构建时间: $BUILD_TIME"