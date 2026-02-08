#!/bin/bash

# Postiz 官方部署脚本
# 根据官方文档: https://docs.postiz.com/installation/docker-compose

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查 Docker 是否运行
check_docker() {
    print_info "检查 Docker 状态..."
    if ! docker ps > /dev/null 2>&1; then
        print_error "Docker 未运行，请先启动 Docker Desktop"
        exit 1
    fi
    print_success "Docker 正在运行"
}

# 检查 docker-compose.yml 是否存在
check_compose_file() {
    if [ ! -f "docker-compose.yml" ]; then
        print_error "未找到 docker-compose.yml 文件"
        print_info "请确保在正确的目录中运行此脚本"
        exit 1
    fi
    print_success "找到 docker-compose.yml 文件"
}

# 拉取镜像（如果需要）
pull_images() {
    print_info "检查并拉取所需镜像..."
    
    # 检查镜像是否存在，如果不存在则拉取
    images=(
        "ghcr.io/gitroomhq/postiz-app:latest"
        "postgres:17-alpine"
        "redis:7.2"
        "elasticsearch:7.17.27"
        "postgres:16"
        "temporalio/auto-setup:1.28.1"
        "temporalio/ui:2.34.0"
        "temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1"
        "ghcr.io/getsentry/spotlight:latest"
    )
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" > /dev/null 2>&1; then
            print_success "镜像已存在: $image"
        else
            print_info "拉取镜像: $image"
            if docker pull "$image" 2>&1 | grep -q "error"; then
                print_warning "镜像拉取失败: $image（可能是网络问题，将继续尝试启动）"
            else
                print_success "镜像拉取成功: $image"
            fi
        fi
    done
}

# 启动服务
start_services() {
    print_info "启动 Postiz 服务..."
    
    # 先启动基础服务
    print_info "启动基础服务（PostgreSQL, Redis, Temporal）..."
    docker compose up -d postiz-postgres postiz-redis temporal-elasticsearch temporal-postgresql temporal temporal-ui spotlight 2>&1 | grep -v "error getting credentials" || true
    
    # 等待基础服务就绪
    print_info "等待基础服务启动（约 30 秒）..."
    sleep 30
    
    # 检查服务健康状态
    print_info "检查服务健康状态..."
    docker compose ps
    
    # 启动主应用
    print_info "启动 Postiz 应用..."
    docker compose up -d postiz
    
    print_success "所有服务已启动"
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "部署完成！"
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
    echo ""
    echo "⏳ 服务正在启动中，请等待 30-60 秒后访问..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# 主函数
main() {
    echo ""
    echo "🚀 Postiz 官方部署脚本"
    echo "   文档: https://docs.postiz.com/installation/docker-compose"
    echo ""
    
    check_docker
    check_compose_file
    
    # 询问是否拉取镜像
    read -p "是否拉取最新镜像？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pull_images
    else
        print_info "跳过镜像拉取，使用现有镜像"
    fi
    
    start_services
    show_access_info
    
    # 询问是否查看日志
    read -p "是否查看应用日志？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose logs -f postiz
    fi
}

# 运行主函数
main
