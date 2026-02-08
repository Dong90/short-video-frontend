# Docker 凭证问题完整解决方案

## 🔍 问题现象

错误信息：
```
error getting credentials - err: exit status 1, out: `One or more parameters passed to the function were not valid. (-50)`
```

## 🎯 根本原因

Docker Desktop 的凭证助手（Credential Helper）配置有问题，导致无法拉取镜像。

---

## ✅ 解决方案（按优先级）

### 方案 1：在 Docker Desktop 中禁用凭证助手（最简单，推荐）

**步骤**：

1. **打开 Docker Desktop**
   - 点击菜单栏的 Docker 图标
   - 或从应用程序中打开

2. **进入设置**
   - 点击右上角的 ⚙️ **设置图标**
   - 或右键点击 Docker 图标 → Settings

3. **找到凭证设置**
   - 左侧菜单：**Resources** → **Advanced**
   - 或直接搜索 "Credential Helper"

4. **禁用凭证助手**
   - 找到 **"Use Docker Credential Helper"** 选项
   - **取消勾选** ✅ → ❌

5. **应用并重启**
   - 点击 **"Apply & Restart"**
   - 等待 Docker Desktop 重启完成

6. **验证**
   ```bash
   docker pull hello-world
   ```
   如果成功拉取，说明问题已解决。

---

### 方案 2：手动编辑配置文件

**步骤**：

1. **备份现有配置**
   ```bash
   cp ~/.docker/config.json ~/.docker/config.json.backup
   ```

2. **编辑配置文件**
   ```bash
   # 使用 nano 编辑器
   nano ~/.docker/config.json
   
   # 或使用 vim
   vim ~/.docker/config.json
   
   # 或使用 VS Code
   code ~/.docker/config.json
   ```

3. **修改配置**
   
   **修改前**（有问题）：
   ```json
   {
     "auths": {},
     "credsStore": "desktop",
     "currentContext": "desktop-linux"
   }
   ```
   
   **修改后**（正确）：
   ```json
   {
     "auths": {},
     "currentContext": "desktop-linux"
   }
   ```
   
   **关键**：删除或注释掉 `"credsStore": "desktop"` 这一行

4. **保存文件**
   - nano: `Ctrl + X` → `Y` → `Enter`
   - vim: `:wq`
   - VS Code: `Cmd + S`

5. **重启 Docker Desktop**
   - 完全退出 Docker Desktop
   - 重新启动

6. **验证**
   ```bash
   docker pull hello-world
   ```

---

### 方案 3：使用脚本自动修复

**步骤**：

1. **运行修复脚本**
   ```bash
   cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app
   ./fix-docker-credential.sh
   ```

2. **重启 Docker Desktop**
   - 完全退出并重新启动

3. **验证**
   ```bash
   docker pull hello-world
   ```

---

### 方案 4：重置 Docker 配置（如果以上都不行）

**步骤**：

1. **备份配置**
   ```bash
   mkdir -p ~/.docker-backup
   cp -r ~/.docker/* ~/.docker-backup/
   ```

2. **删除配置目录**
   ```bash
   rm -rf ~/.docker
   ```

3. **重新创建配置**
   ```bash
   mkdir -p ~/.docker
   cat > ~/.docker/config.json <<EOF
   {
     "auths": {},
     "currentContext": "desktop-linux"
   }
   EOF
   ```

4. **重启 Docker Desktop**
   - 完全退出并重新启动

5. **验证**
   ```bash
   docker pull hello-world
   ```

---

## 🔧 macOS 特定解决方案

### 方法 A：使用 Docker Desktop 设置（推荐）

1. Docker Desktop → Settings
2. Resources → Advanced
3. 取消勾选 "Use Docker Credential Helper"
4. Apply & Restart

### 方法 B：检查 macOS Keychain

有时问题出在 macOS Keychain：

1. **打开 Keychain Access**
   - 应用程序 → 实用工具 → 钥匙串访问

2. **搜索 Docker**
   - 搜索 "Docker" 或 "docker-credential-desktop"

3. **删除相关条目**
   - 删除所有 Docker 相关的凭证
   - 或删除 `docker-credential-desktop` 条目

4. **重启 Docker Desktop**

### 方法 C：重新安装 Docker Desktop（最后手段）

如果以上方法都不行：

1. **卸载 Docker Desktop**
   ```bash
   # 删除应用程序
   rm -rf /Applications/Docker.app
   
   # 删除配置
   rm -rf ~/.docker
   rm -rf ~/Library/Containers/com.docker.docker
   rm -rf ~/Library/Application\ Support/Docker\ Desktop
   ```

2. **重新下载安装**
   - 从官网下载：https://www.docker.com/products/docker-desktop
   - 安装时**不要勾选** "Use Docker Credential Helper"

---

## 🧪 验证修复

修复后，运行以下命令验证：

```bash
# 1. 测试拉取公共镜像
docker pull hello-world

# 2. 如果成功，尝试拉取 Postiz 需要的镜像
docker pull postgres:17-alpine
docker pull redis:7.2

# 3. 如果都成功，启动 Postiz
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app
docker compose up -d
```

---

## 🐛 常见问题

### Q1: 修改配置后仍然报错

**A**: Docker Desktop 需要完全重启才能生效：
1. 完全退出 Docker Desktop（不是最小化）
2. 等待几秒
3. 重新启动

### Q2: 找不到配置文件

**A**: 配置文件可能不存在，创建它：
```bash
mkdir -p ~/.docker
cat > ~/.docker/config.json <<EOF
{
  "auths": {},
  "currentContext": "desktop-linux"
}
EOF
```

### Q3: 权限问题

**A**: 确保有写入权限：
```bash
# 检查权限
ls -la ~/.docker/

# 如果需要，修改权限
chmod 644 ~/.docker/config.json
```

### Q4: Docker Desktop 无法启动

**A**: 
1. 检查系统要求（macOS 版本、内存等）
2. 重启电脑
3. 查看 Docker Desktop 日志

---

## 📋 快速检查清单

- [ ] Docker Desktop 已完全重启
- [ ] `~/.docker/config.json` 中没有 `credsStore`
- [ ] 可以成功运行 `docker pull hello-world`
- [ ] Docker Desktop 设置中已禁用 "Use Docker Credential Helper"

---

## 🎯 推荐流程

1. **首先尝试**：Docker Desktop 设置中禁用凭证助手
2. **如果不行**：手动编辑配置文件
3. **如果还不行**：重置 Docker 配置
4. **最后手段**：重新安装 Docker Desktop

---

## 💡 预防措施

安装 Docker Desktop 时：
- ✅ **不要勾选** "Use Docker Credential Helper"
- ✅ 使用官方 OAuth 认证（更安全）
- ✅ 定期更新 Docker Desktop

---

## 📞 如果还是不行

1. **查看 Docker Desktop 日志**
   - Docker Desktop → Troubleshoot → View logs

2. **检查系统日志**
   ```bash
   # macOS
   log show --predicate 'process == "com.docker.backend"' --last 1h
   ```

3. **联系 Docker 支持**
   - Docker Desktop 帮助 → Report Issue
   - 或访问：https://docs.docker.com/desktop/troubleshoot/

---

## ✅ 成功标志

当看到以下内容时，说明问题已解决：

```bash
$ docker pull hello-world
Using default tag: latest
latest: Pulling from library/hello-world
...
Status: Downloaded newer image for hello-world:latest
```

然后可以正常使用 `docker compose up` 启动 Postiz。
