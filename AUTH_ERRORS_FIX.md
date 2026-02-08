# Postiz 授权错误修复指南

## 🔍 常见授权错误

### 1. JWT 认证失败

**错误信息**：
- `HttpForbiddenException`
- `No auth token found`
- `Invalid token`

**原因**：
- `JWT_SECRET` 未设置或设置错误
- Token 过期
- Cookie 未正确传递

**解决方案**：

#### 步骤 1：检查 JWT_SECRET

```bash
# 查看 docker-compose.yml 中的 JWT_SECRET
grep JWT_SECRET docker-compose.yml

# 确保 JWT_SECRET 是一个随机字符串（至少 32 个字符）
# 例如：JWT_SECRET: 'your-very-long-random-string-here-at-least-32-chars'
```

#### 步骤 2：重新生成 JWT_SECRET

```bash
# 生成一个随机的 JWT_SECRET
openssl rand -base64 32

# 或者使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 步骤 3：更新 docker-compose.yml

```yaml
environment:
  JWT_SECRET: '你生成的随机字符串'  # 替换为上面生成的字符串
```

#### 步骤 4：重启服务

```bash
docker compose down
docker compose up -d
```

---

### 2. 数据库连接问题导致的授权失败

**错误信息**：
- `Database connection failed`
- `Organization not found`
- `User not found`

**原因**：
- 数据库未初始化
- 数据库连接字符串错误
- 数据库权限问题

**解决方案**：

#### 步骤 1：检查数据库连接

```bash
# 检查数据库容器状态
docker compose ps postiz-postgres

# 查看数据库日志
docker compose logs postiz-postgres

# 测试数据库连接
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local -c "SELECT 1;"
```

#### 步骤 2：检查 DATABASE_URL

```yaml
# docker-compose.yml 中应该是：
DATABASE_URL: 'postgresql://postiz-user:postiz-password@postiz-postgres:5432/postiz-db-local'
```

#### 步骤 3：重新初始化数据库

```bash
# 停止服务
docker compose down

# 删除数据库卷（⚠️ 会删除所有数据）
docker volume rm postiz-app_postgres-volume

# 重新启动
docker compose up -d

# 等待数据库初始化完成（约 30 秒）
docker compose logs -f postiz-postgres
```

---

### 3. API Key 认证失败（Public API）

**错误信息**：
- `No API Key found`
- `Invalid API key`
- `No subscription found`

**原因**：
- API Key 未设置
- API Key 格式错误
- 订阅未激活（如果配置了 Stripe）

**解决方案**：

#### 步骤 1：检查是否配置了 Stripe

如果配置了 `STRIPE_SECRET_KEY`，需要订阅才能使用 API：

```yaml
# 如果不想使用 Stripe，确保这些变量为空：
STRIPE_SECRET_KEY: ''
STRIPE_PUBLISHABLE_KEY: ''
```

#### 步骤 2：获取 API Key

1. 登录 Postiz 前端（http://localhost:4007）
2. 进入 Settings → API
3. 复制 API Key
4. 在请求头中使用：`Authorization: your-api-key`

---

### 4. OAuth 第三方登录错误

**错误信息**：
- `OAuth provider not configured`
- `Invalid OAuth credentials`

**原因**：
- OAuth Client ID/Secret 未配置
- OAuth 回调 URL 配置错误

**解决方案**：

#### 步骤 1：检查 OAuth 配置

```bash
# 查看 docker-compose.yml 中的 OAuth 配置
grep -E "(CLIENT_ID|CLIENT_SECRET)" docker-compose.yml
```

#### 步骤 2：配置 OAuth（以 GitHub 为例）

1. 在 GitHub 创建 OAuth App：
   - Settings → Developer settings → OAuth Apps → New OAuth App
   - Authorization callback URL: `http://localhost:4007/auth/github/callback`

2. 更新 docker-compose.yml：

```yaml
environment:
  GITHUB_CLIENT_ID: 'your-github-client-id'
  GITHUB_CLIENT_SECRET: 'your-github-client-secret'
```

3. 重启服务：

```bash
docker compose restart postiz
```

---

### 5. 用户未激活错误

**错误信息**：
- `User not activated`
- `Account disabled`

**原因**：
- 用户账户未激活
- 用户被禁用

**解决方案**：

#### 方法 1：通过数据库激活用户

```bash
# 进入数据库
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local

# 查看用户
SELECT id, email, activated FROM users;

# 激活用户
UPDATE users SET activated = true WHERE email = 'your-email@example.com';

# 退出
\q
```

#### 方法 2：重新注册

如果 `DISABLE_REGISTRATION` 设置为 `false`，可以直接注册新账户。

---

## 🔧 完整修复流程

### 步骤 1：检查所有必需的环境变量

```bash
# 创建检查脚本
cat > check-env.sh <<'EOF'
#!/bin/bash
echo "检查环境变量配置..."

docker compose exec postiz env | grep -E "(JWT_SECRET|DATABASE_URL|REDIS_URL|MAIN_URL|FRONTEND_URL)" || echo "无法连接到容器"

echo ""
echo "检查服务状态..."
docker compose ps
EOF

chmod +x check-env.sh
./check-env.sh
```

### 步骤 2：查看详细错误日志

```bash
# 查看 Postiz 应用日志
docker compose logs -f postiz | grep -i "error\|auth\|forbidden"

# 查看后端日志（如果有）
docker compose logs -f postiz | grep -i "backend"

# 查看前端日志（如果有）
docker compose logs -f postiz | grep -i "frontend"
```

### 步骤 3：验证配置

```bash
# 测试数据库连接
docker compose exec postiz-postgres psql -U postiz-user -d postiz-db-local -c "SELECT version();"

# 测试 Redis 连接
docker compose exec postiz-redis redis-cli ping

# 测试 Temporal 连接
curl http://localhost:7233/health || echo "Temporal 未响应"
```

### 步骤 4：重置所有配置（最后手段）

⚠️ **警告：这会删除所有数据！**

```bash
# 停止所有服务
docker compose down -v

# 删除所有卷
docker volume prune -f

# 重新启动
docker compose up -d

# 等待初始化（约 1-2 分钟）
docker compose logs -f postiz
```

---

## 📋 检查清单

部署前确保：

- [ ] `JWT_SECRET` 已设置（至少 32 个字符的随机字符串）
- [ ] `DATABASE_URL` 格式正确
- [ ] `REDIS_URL` 格式正确
- [ ] `MAIN_URL` 和 `FRONTEND_URL` 一致
- [ ] `NEXT_PUBLIC_BACKEND_URL` 指向正确的 API 地址
- [ ] 数据库容器健康（`docker compose ps` 显示 healthy）
- [ ] Redis 容器健康
- [ ] Temporal 容器运行正常
- [ ] 端口 4007 未被占用
- [ ] 如果使用 Stripe，确保订阅已激活或 `STRIPE_SECRET_KEY` 为空

---

## 🆘 仍然无法解决？

### 1. 查看完整日志

```bash
# 保存所有日志到文件
docker compose logs > postiz-logs.txt 2>&1

# 查看错误
grep -i "error\|exception\|failed" postiz-logs.txt
```

### 2. 检查官方文档

- [Postiz 官方文档](https://docs.postiz.com)
- [GitHub Issues](https://github.com/gitroomhq/postiz-app/issues)

### 3. 常见问题

**Q: 为什么登录后立即被登出？**
A: 检查 `JWT_SECRET` 是否正确，Cookie 域名是否匹配。

**Q: API 调用返回 401？**
A: 检查 API Key 是否正确，请求头格式：`Authorization: your-api-key`

**Q: OAuth 登录失败？**
A: 检查回调 URL 是否与 OAuth App 配置一致。

---

## ✅ 验证修复

修复后，验证以下功能：

1. **访问前端**：http://localhost:4007
2. **注册/登录**：创建账户或登录
3. **API 调用**：使用 API Key 测试 API
4. **OAuth 登录**：测试第三方登录（如果配置了）

如果以上都正常，说明授权问题已解决！
