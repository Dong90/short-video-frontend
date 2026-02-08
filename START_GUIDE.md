# Postiz 启动指南

## ⚠️ 当前状态

Docker 凭证配置已修复，但需要重启 Docker Desktop 才能生效。

## 🔧 必须完成的步骤

### 步骤 1：重启 Docker Desktop（必须）

1. **完全退出 Docker Desktop**
   - 点击 Docker Desktop 图标
   - 选择 "Quit Docker Desktop"
   - 等待完全退出

2. **重新启动 Docker Desktop**
   - 打开 Docker Desktop
   - 等待完全启动（状态栏显示 "Docker Desktop is running"）

### 步骤 2：验证配置

```bash
# 检查 Docker 配置
cat ~/.docker/config.json

# 应该看到（没有 credsStore）：
# {
# 	"auths": {},
# 	"currentContext": "desktop-linux"
# }
```

### 步骤 3：拉取镜像

```bash
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app

# 拉取所需镜像
docker pull postgres:17-alpine
docker pull redis:7.2
docker pull elasticsearch:7.17.27
docker pull postgres:16
docker pull temporalio/auto-setup:1.28.1
docker pull temporalio/ui:2.34.0
docker pull temporalio/admin-tools:1.28.1-tctl-1.18.4-cli-1.4.1
docker pull ghcr.io/getsentry/spotlight:latest
docker pull ghcr.io/gitroomhq/postiz-app:latest
```

### 步骤 4：启动服务

```bash
# 启动所有服务
docker compose up -d

# 或者使用启动脚本
./start-postiz.sh
```

### 步骤 5：检查状态

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f postiz
```

### 步骤 6：访问应用

等待 30-60 秒后访问：
- **Postiz 前端**: http://localhost:4007
- **Temporal UI**: http://localhost:8080
- **Spotlight**: http://localhost:8969

## 🚨 如果还有凭证错误

### 方法 A：在 Docker Desktop 中修复

1. 打开 Docker Desktop
2. Settings > Resources > Advanced
3. **取消勾选** "Use Docker Credential Helper"
4. 点击 "Apply & Restart"

### 方法 B：手动修复配置

```bash
# 编辑配置文件
nano ~/.docker/config.json

# 确保内容如下（没有 credsStore）：
{
	"auths": {},
	"currentContext": "desktop-linux"
}

# 保存后重启 Docker Desktop
```

## 📝 快速启动命令序列

```bash
# 1. 确保 Docker Desktop 已重启
# （手动操作：退出并重新启动 Docker Desktop）

# 2. 进入项目目录
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app

# 3. 拉取镜像（如果还没有）
docker pull postgres:17-alpine
docker pull redis:7.2
docker pull ghcr.io/gitroomhq/postiz-app:latest
# ... 其他镜像

# 4. 启动服务
docker compose up -d

# 5. 等待并检查
sleep 30
docker compose ps

# 6. 访问
open http://localhost:4007
```

## 🔍 故障排查

### 问题 1：仍然有凭证错误

**解决**：
1. 完全退出 Docker Desktop
2. 重新启动 Docker Desktop
3. 再次尝试

### 问题 2：镜像拉取失败

**解决**：
```bash
# 检查网络连接
ping docker.io

# 尝试手动拉取
docker pull postgres:17-alpine

# 如果失败，检查 Docker Desktop 网络设置
```

### 问题 3：端口被占用

**解决**：
```bash
# 检查端口占用
lsof -i :4007
lsof -i :5432
lsof -i :6379

# 如果被占用，修改 docker-compose.yml 中的端口
```

### 问题 4：服务启动失败

**解决**：
```bash
# 查看详细日志
docker compose logs

# 查看特定服务日志
docker compose logs postiz
docker compose logs postiz-postgres

# 检查服务依赖
docker compose ps
```

## ✅ 成功标志

当看到以下内容时，说明启动成功：

```bash
$ docker compose ps
NAME                STATUS
postiz              Up (healthy)
postiz-postgres     Up (healthy)
postiz-redis        Up (healthy)
temporal            Up
temporal-ui         Up
...
```

然后访问 http://localhost:4007 应该能看到 Postiz 界面。
