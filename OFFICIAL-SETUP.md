# Postiz 官方 Docker Compose 安装指南

根据 [官方文档](https://docs.postiz.com/installation/docker-compose) 配置的完整安装指南。

## 📋 前置要求

- Docker 和 Docker Compose 已安装
- 至少 2GB RAM 和 2 vCPUs（推荐）
- Docker Desktop 正在运行

## 🔧 解决 Docker 凭证问题

如果遇到 `error getting credentials` 错误，请按以下步骤操作：

### 方法 1：在 Docker Desktop 中修复（推荐）

1. 打开 **Docker Desktop**
2. 点击右上角 **设置图标** ⚙️
3. 进入 **Settings > Resources > Advanced**
4. **取消勾选** "Use Docker Credential Helper"
5. 点击 **"Apply & Restart"**
6. 等待 Docker 重启完成

### 方法 2：手动编辑配置文件

```bash
# 备份现有配置
cp ~/.docker/config.json ~/.docker/config.json.backup

# 编辑配置文件
nano ~/.docker/config.json

# 移除或注释掉这一行：
# "credsStore": "desktop",

# 保存后重启 Docker Desktop
```

## 🚀 安装步骤

### 步骤 1: 拉取镜像

**方法 A：使用脚本（推荐）**

```bash
./pull-images.sh
```

**方法 B：手动拉取**

```bash
docker pull ghcr.io/gitroomhq/postiz-app:latest
docker pull postgres:17-alpine
docker pull redis:7.2
docker pull elasticsearch:7.17.27
docker pull postgres:16
docker pull temporalio/auto-setup:1.28.1
docker pull temporalio/ui:2.34.0
docker pull temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1
docker pull ghcr.io/getsentry/spotlight:latest
```

### 步骤 2: 启动服务

```bash
# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f postiz
```

### 步骤 3: 等待服务就绪

服务启动需要一些时间（约 30-60 秒），特别是：
- PostgreSQL 数据库初始化
- Temporal 工作流引擎启动
- Elasticsearch 索引创建

检查服务状态：

```bash
# 检查所有服务
docker compose ps

# 应该看到所有服务都是 "Up" 或 "healthy" 状态
# 如果看到 "unhealthy"，等待更长时间或查看日志：
docker compose logs [服务名]
```

## 🌐 访问地址

启动成功后，可以通过以下地址访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| **Postiz 前端** | http://localhost:4007 | 主应用界面 |
| **Temporal UI** | http://localhost:8080 | 工作流监控 |
| **Spotlight** | http://localhost:8969 | 应用监控/调试 |

## ⚙️ 配置说明

### 关键环境变量

`docker-compose.yml` 中的关键配置：

- **MAIN_URL**: `http://localhost:4007` - 主访问地址
- **FRONTEND_URL**: `http://localhost:4007` - 前端地址
- **JWT_SECRET**: 随机字符串（生产环境必须修改）
- **DATABASE_URL**: 数据库连接字符串
- **REDIS_URL**: Redis 连接字符串
- **TEMPORAL_ADDRESS**: `temporal:7233` - Temporal 服务地址

### 数据库连接信息

- **主机**: `postiz-postgres` (容器内) 或 `localhost` (外部)
- **端口**: `5432`
- **数据库**: `postiz-db-local`
- **用户名**: `postiz-user`
- **密码**: `postiz-password`

### 社交媒体 API 配置

在 `docker-compose.yml` 中配置各平台的 API 密钥：

```yaml
X_API_KEY: 'your-x-api-key'
X_API_SECRET: 'your-x-api-secret'
LINKEDIN_CLIENT_ID: 'your-linkedin-client-id'
# ... 等等
```

配置后需要重启服务：

```bash
docker compose down
docker compose up -d
```

## 🔍 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看应用日志
docker compose logs -f postiz

# 查看所有日志
docker compose logs -f

# 重启服务
docker compose restart postiz

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 会删除所有数据）
docker compose down -v

# 进入容器
docker compose exec postiz sh

# 查看数据库
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local
```

## 🐛 故障排查

### 1. 端口冲突

如果端口被占用，修改 `docker-compose.yml`：

```yaml
ports:
  - "4008:5000"  # 改为其他端口
```

### 2. 数据库连接失败

```bash
# 检查数据库健康状态
docker compose exec postiz-postgres pg_isready -U postiz-user

# 查看数据库日志
docker compose logs postiz-postgres

# 手动连接测试
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local
```

### 3. 应用启动失败

```bash
# 查看详细日志
docker compose logs postiz

# 检查环境变量
docker compose exec postiz env | grep -E "DATABASE|REDIS|JWT"

# 检查服务依赖
docker compose ps
```

### 4. Temporal 连接失败

```bash
# 检查 Temporal 状态
docker compose ps temporal

# 查看 Temporal 日志
docker compose logs temporal

# 访问 Temporal UI
open http://localhost:8080
```

### 5. 镜像拉取失败

如果镜像拉取失败，可能是：
- Docker 凭证问题（见上方解决方案）
- 网络问题（检查网络连接）
- 镜像不存在（检查镜像名称是否正确）

```bash
# 手动测试拉取
docker pull ghcr.io/gitroomhq/postiz-app:latest

# 如果失败，检查网络
ping ghcr.io
```

## 📝 首次运行后的步骤

1. **访问前端**: http://localhost:4007
2. **注册账号**: 首次访问会提示注册（如果 `DISABLE_REGISTRATION: 'false'`）
3. **配置社交媒体 API**: 在设置中配置各平台的 API 密钥
4. **创建内容**: 开始创建和调度社交媒体帖子

## 🔄 更新应用

```bash
# 停止服务
docker compose down

# 拉取最新镜像
docker pull ghcr.io/gitroomhq/postiz-app:latest

# 启动服务
docker compose up -d
```

## 💾 数据备份

```bash
# 备份数据库
docker compose exec postiz-postgres pg_dump -U postiz-user postiz-db-local > backup.sql

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
docker rmi ghcr.io/gitroomhq/postiz-app:latest
```

## 📚 参考文档

- [官方 Docker Compose 文档](https://docs.postiz.com/installation/docker-compose)
- [配置参考](https://docs.postiz.com/configuration/reference)
- [Docker Compose 配置](https://docs.postiz.com/configuration/docker)
- [支持页面](https://docs.postiz.com/support)

## 🎥 视频教程

官方提供了 Docker Compose 安装的视频教程：
https://m.youtube.com/watch?v=A6CjAmJOWvA&t=5s
