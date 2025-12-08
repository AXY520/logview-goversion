#!/bin/bash

# 运行脚本
echo "正在启动Go版本的日志查看器..."

# 检查可执行文件是否存在
if [ ! -f "logview-server" ]; then
    echo "可执行文件不存在，正在构建..."
    ./build.sh
    if [ $? -ne 0 ]; then
        echo "构建失败，无法运行"
        exit 1
    fi
fi

# 创建必要的目录
mkdir -p storage/zips
mkdir -p storage/extracted

# 设置端口（默认5000）
PORT=${PORT:-5000}

echo "启动服务器在端口 $PORT..."
echo "访问地址: http://localhost:$PORT"
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动应用
export PORT=$PORT
./logview-server