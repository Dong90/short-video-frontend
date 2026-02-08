#!/bin/bash

# Postiz 启动脚本

set -e

echo "🚀 启动 Postiz..."

# 检查 Docker
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 检查配置文件
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到 docker-compose.yml 文件"
    exit 1
fi

# 启动服务
echo "📦 启动服务..."
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动（30秒）..."
sleep 30

# 检查状态
echo "🔍 检查服务状态..."
docker compose ps

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 服务已启动！"
echo ""
echo "📋 访问地址："
echo "   🌐 Postiz 前端:    http://localhost:4007"
echo "   📊 Temporal UI:   http://localhost:8080"
echo "   🔍 Spotlight:     http://localhost:8969"
echo ""
echo "📝 常用命令："
echo "   查看日志:    docker compose logs -f postiz"
echo "   查看状态:    docker compose ps"
echo "   停止服务:    docker compose down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
