#!/bin/bash

# 构建脚本
echo "正在构建Go版本的日志查看器..."

# 检查Go环境
if ! command -v go &> /dev/null; then
    echo "错误: 未找到Go环境，请先安装Go"
    exit 1
fi

# 清理之前的构建
if [ -f "logview-server" ]; then
    echo "清理之前的构建文件..."
    rm -f logview-server
fi

# 下载依赖
echo "下载依赖..."
go mod tidy

# 构建应用
echo "构建应用..."
go build -o logview-server .

if [ $? -eq 0 ]; then
    echo "构建成功！"
    echo "可执行文件: ./logview-server"
    echo ""
    echo "运行应用:"
    echo "  ./logview-server"
    echo ""
    echo "或者使用:"
    echo "  ./run.sh"
else
    echo "构建失败！"
    exit 1
fi