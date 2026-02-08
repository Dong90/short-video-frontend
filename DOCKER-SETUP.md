# Postiz Docker 运行指南

## 🚀 快速启动

### 方法一：使用启动脚本（推荐）

```bash
# 启动基础服务
./start-docker.sh

# 构建并启动完整应用
./start-docker.sh --build
```

### 方法二：手动启动

#### 1. 启动基础服务

```bash
docker compose up -d postiz-postgres postiz-redis temporal-elasticsearch temporal-postgresql temporal temporal-ui
```

#### 2. 等待服务就绪（约 30-60 秒）

```bash
# 检查服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

#### 3. 构建并启动应用

```bash
# 构建应用镜像（首次运行或代码更新后需要）
docker compose build postiz

# 启动应用
docker compose up -d postiz
```

## 🔧 如果遇到 Docker 凭证错误

如果看到 `error getting credentials` 错误，可以尝试以下解决方案：

### 方案 1：重置 Docker 凭证助手（macOS）

```bash
# 移除凭证助手配置
rm ~/.docker/config.json

# 或者在 Docker Desktop 中：
# Settings > Resources > Advanced > 取消勾选 "Use Docker Credential Helper"
```

### 方案 2：使用现有镜像

如果本地已有镜像，可以直接启动：

```bash
# 检查本地镜像
docker images | grep -E "postgres|redis|temporal|elasticsearch"

# 如果镜像存在，直接启动
docker compose up -d
```

### 方案 3：手动拉取镜像

```bash
# 拉取所需镜像
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

## 📋 服务访问地址

启动成功后，可以通过以下地址访问：

- **Postiz 前端**: http://localhost:4007
- **Temporal UI** (工作流监控): http://localhost:8080
- **PGAdmin** (数据库管理): http://localhost:8081
  - 邮箱: admin@admin.com
  - 密码: admin
- **Redis Insight** (Redis 管理): http://localhost:5540

## 🔍 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看应用日志
docker compose logs -f postiz

# 查看所有日志
docker compose logs -f

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会删除所有数据）
docker compose down -v

# 重启服务
docker compose restart postiz

# 进入容器
docker compose exec postiz sh
```

## 🗄️ 数据库连接信息

- **主机**: localhost
- **端口**: 5432
- **数据库**: postiz-db-local
- **用户名**: postiz-local
- **密码**: postiz-local-pwd

## 🔐 环境变量配置

主要配置在 `docker-compose.yml` 的 `postiz` 服务中。关键配置：

- `JWT_SECRET`: JWT 密钥（生产环境必须修改）
- `DATABASE_URL`: 数据库连接字符串
- `REDIS_URL`: Redis 连接字符串
- `FRONTEND_URL`: 前端访问地址
- `TEMPORAL_ADDRESS`: Temporal 服务地址

## 🐛 故障排查

### 1. 端口冲突

如果端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "4007:5000"  # 改为其他端口，如 "4008:5000"
```

### 2. 数据库连接失败

```bash
# 检查数据库是否健康
docker compose ps postiz-postgres

# 查看数据库日志
docker compose logs postiz-postgres

# 手动连接测试
docker compose exec postiz-postgres psql -U postiz-local -d postiz-db-local
```

### 3. 应用启动失败

```bash
# 查看详细日志
docker compose logs postiz

# 检查环境变量
docker compose exec postiz env | grep -E "DATABASE|REDIS|JWT"

# 重新构建
docker compose build --no-cache postiz
```

### 4. Temporal 连接失败

```bash
# 检查 Temporal 状态
docker compose ps temporal

# 查看 Temporal 日志
docker compose logs temporal

# 访问 Temporal UI 检查
open http://localhost:8080
```

## 📝 首次运行后的步骤

1. **访问前端**: http://localhost:4007
2. **注册账号**: 首次访问会提示注册
3. **配置社交媒体 API**: 在设置中配置各平台的 API 密钥
4. **创建内容**: 开始创建和调度社交媒体帖子

## 🔄 更新应用

```bash
# 停止服务
docker compose down

# 拉取最新代码
git pull

# 重新构建
docker compose build --no-cache postiz

# 启动服务
docker compose up -d
```

## 💾 数据备份

```bash
# 备份数据库
docker compose exec postiz-postgres pg_dump -U postiz-local postiz-db-local > backup.sql

# 备份上传文件
docker compose exec postiz tar czf /tmp/uploads-backup.tar.gz /uploads
```

## 🗑️ 清理

```bash
# 停止并删除容器
docker compose down

# 删除数据卷（⚠️ 会删除所有数据）
docker compose down -v

# 删除镜像
docker rmi postiz-postiz
```
