# Postiz 官方部署指南

根据 [官方文档](https://docs.postiz.com/installation/docker-compose) 的完整部署步骤。

## 📺 视频教程

官方提供了详细的视频教程：
👉 [YouTube 教程](https://m.youtube.com/watch?v=A6CjAmJOWvA&t=5s)

## 📋 前置要求

- ✅ Docker 和 Docker Compose 已安装
- ✅ 至少 2GB RAM 和 2 vCPUs（推荐）
- ✅ Docker Desktop 正在运行
- ✅ 系统要求：Ubuntu 24.04（已测试）

## 🚀 快速部署（3 步）

### 方法 1：使用官方仓库（推荐）

```bash
# 1. 克隆官方 Docker Compose 仓库
git clone https://github.com/gitroomhq/postiz-docker-compose
cd postiz-docker-compose

# 2. 启动服务
docker compose up

# 3. 等待加载完成，访问 http://localhost:4007
```

### 方法 2：使用现有配置

如果你已经有 `docker-compose.yml` 文件：

```bash
# 1. 进入项目目录
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app

# 2. 启动服务
docker compose up

# 3. 等待加载完成，访问 http://localhost:4007
```

## 📝 详细部署步骤

### 步骤 1: 准备环境

确保 Docker 正在运行：

```bash
# 检查 Docker 状态
docker ps

# 如果 Docker 未运行，启动 Docker Desktop
```

### 步骤 2: 配置环境变量（可选）

官方支持三种配置方式：

**方式 A：在 docker-compose.yml 中配置（当前使用）**

环境变量已经在 `docker-compose.yml` 中配置好了。

**方式 B：使用 postiz.env 文件**

创建 `postiz.env` 文件并挂载到 `/config`：

```bash
# 创建配置文件
cat > postiz.env <<EOF
MAIN_URL=http://localhost:4007
FRONTEND_URL=http://localhost:4007
JWT_SECRET=your-random-secret-key-here
DATABASE_URL=postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local
REDIS_URL=redis://postiz-redis:6379
EOF

# 在 docker-compose.yml 中添加卷挂载
volumes:
  - ./postiz.env:/config/postiz.env
```

**方式 C：使用 .env 文件（不推荐）**

在 `docker-compose.yml` 同目录创建 `.env` 文件。

### 步骤 3: 启动服务

```bash
# 启动所有服务（前台运行，可以看到日志）
docker compose up

# 或者后台运行
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f postiz
```

### 步骤 4: 等待服务就绪

服务启动需要一些时间（约 30-60 秒），特别是：

- ✅ PostgreSQL 数据库初始化
- ✅ Temporal 工作流引擎启动
- ✅ Elasticsearch 索引创建
- ✅ Postiz 应用启动

检查服务状态：

```bash
# 检查所有服务
docker compose ps

# 应该看到所有服务都是 "Up" 或 "healthy" 状态
# 如果看到 "unhealthy"，等待更长时间或查看日志：
docker compose logs [服务名]
```

### 步骤 5: 访问应用

启动成功后，访问以下地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| **Postiz 前端** | http://localhost:4007 | 主应用界面 |
| **Temporal UI** | http://localhost:8080 | 工作流监控 |

## ⚙️ 关键配置说明

### 必需的环境变量

```yaml
MAIN_URL: 'http://localhost:4007'                    # 主访问地址
FRONTEND_URL: 'http://localhost:4007'                # 前端地址
NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4007/api' # API 地址
JWT_SECRET: 'random string...'                       # JWT 密钥（必须修改）
DATABASE_URL: 'postgresql://...'                     # 数据库连接
REDIS_URL: 'redis://postiz-redis:6379'               # Redis 连接
TEMPORAL_ADDRESS: "temporal:7233"                    # Temporal 地址
```

### 数据库连接信息

- **主机**: `postiz-postgres` (容器内) 或 `localhost` (外部)
- **端口**: `5432`
- **数据库**: `postiz-db-local`
- **用户名**: `postiz-user`
- **密码**: `postiz-password`

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

如果端口被占用：

```bash
# 检查端口占用
lsof -i :4007
lsof -i :8080

# 修改 docker-compose.yml 中的端口映射
ports:
  - "4008:5000"  # 改为其他端口
```

### 2. Docker 凭证错误

如果遇到 `error getting credentials`：

1. 打开 Docker Desktop
2. Settings > Resources > Advanced
3. 取消勾选 "Use Docker Credential Helper"
4. 重启 Docker Desktop

### 3. 服务启动失败

```bash
# 查看详细日志
docker compose logs postiz

# 检查服务依赖
docker compose ps

# 检查环境变量
docker compose exec postiz env | grep -E "DATABASE|REDIS|JWT"
```

### 4. 数据库连接失败

```bash
# 检查数据库健康状态
docker compose exec postiz-postgres pg_isready -U postiz-user

# 查看数据库日志
docker compose logs postiz-postgres

# 手动连接测试
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local
```

### 5. Temporal 连接失败

```bash
# 检查 Temporal 状态
docker compose ps temporal

# 查看 Temporal 日志
docker compose logs temporal

# 访问 Temporal UI
open http://localhost:8080
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

## ⚠️ 重要提示

### 升级注意事项

如果从旧版本升级，请确保更新 docker-compose 配置：
👉 [v2.12.0 升级说明](https://github.com/gitroomhq/postiz-app/releases/tag/v2.12.0)

### 配置变更后

**重要**：修改环境变量后，必须重新创建容器：

```bash
docker compose down
docker compose up -d
```

## 📚 参考文档

- [官方 Docker Compose 文档](https://docs.postiz.com/installation/docker-compose)
- [配置参考](https://docs.postiz.com/configuration/reference)
- [Docker Compose 配置](https://docs.postiz.com/configuration/docker)
- [支持页面](https://docs.postiz.com/support)
- [官方 GitHub 仓库](https://github.com/gitroomhq/postiz-docker-compose)

## 🎥 视频教程

官方提供了详细的视频教程：
👉 [YouTube: Docker Compose 安装教程](https://m.youtube.com/watch?v=A6CjAmJOWvA&t=5s)
