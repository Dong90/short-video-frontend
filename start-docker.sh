#!/bin/bash

# Postiz Docker 启动脚本

set -e

echo "🚀 启动 Postiz Docker 服务..."

# 检查 Docker 是否运行
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 先启动基础服务
echo "📦 启动基础服务（PostgreSQL, Redis, Temporal）..."
docker compose up -d postiz-postgres postiz-redis temporal-elasticsearch temporal-postgresql temporal temporal-ui

# 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker compose ps

# 构建并启动应用（如果需要）
if [ "$1" == "--build" ]; then
    echo "🔨 构建 Postiz 应用镜像..."
    docker compose build postiz
    
    echo "🚀 启动 Postiz 应用..."
    docker compose up -d postiz
else
    echo "💡 提示: 使用 --build 参数来构建应用镜像"
    echo "   例如: ./start-docker.sh --build"
fi

echo ""
echo "✅ 服务启动完成！"
echo ""
echo "📋 访问地址："
echo "   - Postiz 前端: http://localhost:4007"
echo "   - Temporal UI: http://localhost:8080"
echo "   - PGAdmin: http://localhost:8081 (admin@admin.com / admin)"
echo "   - Redis Insight: http://localhost:5540"
echo ""
echo "📊 查看日志: docker compose logs -f postiz"
echo "🛑 停止服务: docker compose down"
