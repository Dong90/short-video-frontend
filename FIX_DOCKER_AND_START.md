# 修复 Docker 凭证问题并启动 Postiz

## ⚠️ 当前问题

遇到错误：`error getting credentials - err: exit status 1`

这是 Docker Desktop 的凭证助手配置问题。

## 🔧 解决方案

### 方法 1：在 Docker Desktop 中修复（推荐）

1. **打开 Docker Desktop**
2. **点击右上角设置图标** ⚙️
3. **进入 Settings > Resources > Advanced**
4. **取消勾选** "Use Docker Credential Helper"
5. **点击 "Apply & Restart"**
6. **等待 Docker 重启完成**

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

### 方法 3：临时禁用凭证助手

```bash
# 临时设置环境变量
export DOCKER_CONFIG=~/.docker
unset DOCKER_CONFIG

# 或者直接修改配置文件
cat > ~/.docker/config.json <<EOF
{
	"auths": {},
	"currentContext": "desktop-linux"
}
EOF

# 重启 Docker Desktop
```

## 🚀 修复后启动 Postiz

### 步骤 1：拉取镜像（如果需要）

```bash
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app

# 拉取所需镜像
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

### 步骤 2：启动服务

```bash
# 启动所有服务
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f postiz
```

### 步骤 3：访问应用

启动成功后（约 30-60 秒），访问：
- **Postiz 前端**: http://localhost:4007
- **Temporal UI**: http://localhost:8080
- **Spotlight**: http://localhost:8969

## 🔍 验证服务运行

```bash
# 检查所有容器状态
docker compose ps

# 应该看到所有服务都是 "Up" 或 "healthy" 状态
# 如果看到 "unhealthy"，等待更长时间或查看日志：
docker compose logs [服务名]
```

## 🐛 如果还有问题

### 检查 Docker 是否运行

```bash
docker ps
```

如果命令失败，说明 Docker 未运行，请启动 Docker Desktop。

### 检查端口占用

```bash
# 检查端口是否被占用
lsof -i :4007
lsof -i :8080
lsof -i :5432
lsof -i :6379

# 如果端口被占用，修改 docker-compose.yml 中的端口映射
```

### 查看详细日志

```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs postiz
docker compose logs postiz-postgres
docker compose logs postiz-redis
```

## 📝 快速启动脚本

创建并运行：

```bash
#!/bin/bash
# start-postiz.sh

echo "🚀 启动 Postiz..."

# 检查 Docker
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 启动服务
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app
docker compose up -d

# 等待服务启动
echo "⏳ 等待服务启动（30秒）..."
sleep 30

# 检查状态
docker compose ps

echo ""
echo "✅ 服务已启动！"
echo "📋 访问地址："
echo "   - Postiz: http://localhost:4007"
echo "   - Temporal UI: http://localhost:8080"
```

保存为 `start-postiz.sh`，然后运行：
```bash
chmod +x start-postiz.sh
./start-postiz.sh
```
