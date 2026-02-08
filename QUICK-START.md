# Postiz Docker 快速启动指南

## ⚠️ 当前问题：Docker 凭证助手错误

如果遇到 `error getting credentials` 错误，请按以下步骤操作：

### 步骤 1: 修复 Docker 凭证配置

**方法 A：使用修复脚本**
```bash
./fix-docker-credentials.sh
```

**方法 B：手动修复**
```bash
# 备份现有配置
cp ~/.docker/config.json ~/.docker/config.json.backup

# 编辑配置文件，移除 credsStore 行
# 或者直接运行：
cat > ~/.docker/config.json <<EOF
{
	"auths": {},
	"currentContext": "desktop-linux"
}
EOF
```

**方法 C：在 Docker Desktop 中修复**
1. 打开 Docker Desktop
2. 进入 Settings > Resources > Advanced
3. 取消勾选 "Use Docker Credential Helper"
4. 点击 "Apply & Restart"

### 步骤 2: 手动拉取镜像

由于凭证问题，需要手动拉取镜像：

```bash
# 拉取所有需要的镜像
docker pull postgres:17-alpine
docker pull redis:7-alpine
docker pull elasticsearch:7.17.27
docker pull postgres:16
docker pull temporalio/auto-setup:1.28.1
docker pull temporalio/ui:2.34.0
docker pull temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1
docker pull dpage/pgadmin4:latest
docker pull redis/redisinsight:latest
```

### 步骤 3: 启动服务

```bash
# 启动基础服务
docker compose up -d postiz-postgres postiz-redis temporal-elasticsearch temporal-postgresql temporal temporal-ui

# 等待 30-60 秒让服务启动完成
sleep 30

# 检查服务状态
docker compose ps

# 构建并启动应用
docker compose build postiz
docker compose up -d postiz
```

### 步骤 4: 访问应用

- **Postiz 前端**: http://localhost:4007
- **Temporal UI**: http://localhost:8080
- **PGAdmin**: http://localhost:8081

## 📋 完整启动命令序列

```bash
# 1. 修复凭证（如果需要）
./fix-docker-credentials.sh

# 2. 拉取镜像
docker pull postgres:17-alpine && \
docker pull redis:7-alpine && \
docker pull elasticsearch:7.17.27 && \
docker pull postgres:16 && \
docker pull temporalio/auto-setup:1.28.1 && \
docker pull temporalio/ui:2.34.0 && \
docker pull temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1 && \
docker pull dpage/pgadmin4:latest && \
docker pull redis/redisinsight:latest

# 3. 启动基础服务
docker compose up -d postiz-postgres postiz-redis temporal-elasticsearch temporal-postgresql temporal temporal-ui

# 4. 等待服务就绪
echo "等待服务启动..." && sleep 30

# 5. 检查状态
docker compose ps

# 6. 构建应用
docker compose build postiz

# 7. 启动应用
docker compose up -d postiz

# 8. 查看日志
docker compose logs -f postiz
```

## 🔍 验证服务运行

```bash
# 检查所有容器状态
docker compose ps

# 应该看到所有服务都是 "Up" 状态
# 如果看到 "unhealthy" 或 "restarting"，查看日志：
docker compose logs [服务名]
```

## 🐛 常见问题

### 问题 1: 端口被占用

```bash
# 检查端口占用
lsof -i :4007
lsof -i :5432
lsof -i :6379

# 修改 docker-compose.yml 中的端口映射
```

### 问题 2: 数据库连接失败

```bash
# 检查数据库健康状态
docker compose exec postiz-postgres pg_isready -U postiz-local

# 查看数据库日志
docker compose logs postiz-postgres
```

### 问题 3: 应用构建失败

```bash
# 查看构建日志
docker compose build postiz --progress=plain

# 清理并重新构建
docker compose build --no-cache postiz
```

## 📝 下一步

1. 访问 http://localhost:4007 注册账号
2. 配置社交媒体 API 密钥
3. 开始创建和调度帖子

更多详细信息请查看 `DOCKER-SETUP.md`
