#!/bin/bash
set -e

cd /app

# 确保依赖已安装（首次挂载时代码覆盖后 node_modules 可能为空）
if [ ! -f node_modules/.pnpm/lock.yaml ] 2>/dev/null && [ ! -d node_modules/.pnpm ]; then
  echo "Running pnpm install (first run with code mount)..."
  pnpm install --frozen-lockfile
fi

# 数据库迁移（与 start.sh 一致）
pnpm run prisma-db-push --accept-data-loss

# 启动 nginx（后台）
nginx

# 运行 dev 模式（热更新），NODE_OPTIONS 由 docker-compose 环境传入
exec pnpm run dev
