# Docker 凭证问题最终解决方案

## ✅ 配置文件已修复

配置文件已经更新（移除了 `credsStore`），但 Docker Desktop 可能还在使用缓存配置。

## 🔧 必须在 Docker Desktop 中操作

### 步骤 1：打开 Docker Desktop 设置

1. **打开 Docker Desktop**
2. **点击右上角的 ⚙️ 设置图标**
3. **或右键点击菜单栏的 Docker 图标 → Settings**

### 步骤 2：禁用凭证助手

1. **左侧菜单选择：Resources**
2. **点击：Advanced**
3. **找到：Use Docker Credential Helper**
4. **取消勾选** ✅ → ❌（重要！）
5. **点击：Apply & Restart**

### 步骤 3：等待重启完成

- 等待 Docker Desktop 完全重启
- 状态栏显示 "Docker Desktop is running"

### 步骤 4：验证修复

```bash
# 测试拉取镜像
docker pull hello-world
```

如果成功，应该看到：
```
Using default tag: latest
latest: Pulling from library/hello-world
...
Status: Downloaded newer image for hello-world:latest
```

### 步骤 5：启动 Postiz

```bash
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app

# 拉取镜像
docker pull postgres:17-alpine
docker pull redis:7.2
docker pull ghcr.io/gitroomhq/postiz-app:latest

# 启动服务
docker compose up -d

# 查看状态
docker compose ps
```

## ⚠️ 为什么必须这样做？

即使配置文件已修复，Docker Desktop 的设置优先级更高。如果 Docker Desktop 设置中启用了 "Use Docker Credential Helper"，它会覆盖配置文件。

## 📸 设置位置图示

```
Docker Desktop
  └─ Settings (⚙️)
      └─ Resources
          └─ Advanced
              └─ [ ] Use Docker Credential Helper  ← 取消勾选这里
```

## ✅ 完成后的验证

修复成功后，运行：
```bash
docker pull hello-world
docker compose up -d
```

应该可以正常工作了！
