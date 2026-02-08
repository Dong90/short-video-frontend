#!/bin/bash

# 手动拉取 Postiz 所需的所有 Docker 镜像

set -e

echo "📦 开始拉取 Postiz Docker 镜像..."
echo ""

# 定义镜像列表
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

# 拉取每个镜像
for image in "${images[@]}"; do
  echo "⬇️  拉取镜像: $image"
  if docker pull "$image"; then
    echo "✅ 成功拉取: $image"
  else
    echo "❌ 拉取失败: $image"
    echo "   如果遇到凭证错误，请先修复 Docker 凭证配置"
    exit 1
  fi
  echo ""
done

echo "🎉 所有镜像拉取完成！"
echo ""
echo "下一步：运行 docker compose up -d 启动服务"
