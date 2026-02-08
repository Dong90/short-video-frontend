#!/bin/bash
set -e

cd /app

# 先启动 nginx（后台）
nginx

# 启动 pm2 各服务
pm2 delete all 2>/dev/null || true
pnpm run prisma-db-push --accept-data-loss
pnpm run --parallel pm2

# 等待后端就绪，避免 502（最多 120 秒）
echo "Waiting for backend to be ready..."
for i in $(seq 1 120); do
  if curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "Backend is ready."
    break
  fi
  if [ $i -eq 120 ]; then
    echo "WARNING: Backend did not become ready in 120s, continuing anyway."
  fi
  sleep 1
done

# 前台输出 pm2 日志
exec pm2 logs
