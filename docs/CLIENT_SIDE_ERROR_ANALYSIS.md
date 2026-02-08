# Postiz "Application error: a client-side exception has occurred" 详细分析

## 一、错误含义

这是 **Next.js 的通用错误提示**，表示前端发生了**未捕获的 JavaScript 异常**。真实错误信息在浏览器控制台（F12 → Console）中。

---

## 二、错误触发流程

```
用户操作 → 某组件抛出异常 → 未被 try/catch 或 Error Boundary 捕获
    → Next.js 显示 "Application error: a client-side exception has occurred"
```

---

## 三、Postiz 中常见原因

### 1. 后端 500 引发的连锁反应

| 场景 | 可能问题 |
|------|----------|
| 连接 YouTube 后回调 | 后端 `/integrations/social/youtube/connect` 返回 500 |
| 页面加载时请求数据 | `/integrations/list`、`/webhooks` 等返回 500 |
| 组件未正确处理错误 | 期望 JSON 却收到 HTML 错误页，`response.json()` 抛错 |

### 2. 环境变量问题（Docker 部署）

**关键点**：Next.js 的 `NEXT_PUBLIC_*` 变量在**构建时**写入前端代码，运行时修改通常无效。

| 变量 | 作用 | 异常后果 |
|------|------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | API 基础地址 | 为空时 `fetch(undefined + url)` 导致请求失败 |
| `FRONTEND_URL` | 前端地址 | OAuth 回调地址错误 |

使用官方镜像时，若构建时未传入正确 env，客户端可能拿到空值或错误值。

### 3. 数据为 undefined 导致崩溃

```javascript
// 危险写法：data 可能为 undefined
data.map(...)        // TypeError: Cannot read property 'map' of undefined
data.length          // 无报错但可能逻辑错误
await response.json() // 响应非 JSON 时抛错
```

### 4. global-error 自身的潜在问题

`global-error.tsx` 使用 `useVariables()`，但该组件在错误时**会替换整个根布局**，此时可能没有 `VariableContextProvider`。虽然 `useContext` 会回退到默认值，在极端情况下仍可能引发二次错误。

### 5. 依赖服务未就绪

- PostgreSQL、Redis、Temporal 未启动或连接失败
- 后端启动时依赖未就绪，导致部分接口持续 500

---

## 四、排查步骤

### 步骤 1：查看浏览器控制台

1. 按 **F12** 打开开发者工具
2. 切到 **Console**
3. 找到红色报错，记录完整堆栈

### 步骤 2：查看 Network 请求

1. 开发者工具 → **Network**
2. 刷新或重试操作
3. 查看失败请求的状态码和响应内容（是否为 500、HTML 错误页等）

### 步骤 3：查看 Postiz 容器日志

```bash
docker logs postiz --tail 200
```

关注是否有数据库、Redis、Temporal 或业务异常。

### 步骤 4：确认服务状态

```bash
docker compose ps
```

确认 postiz、postiz-postgres、postiz-redis、temporal 等均为 Up/healthy。

---

## 五、修复建议

### 1. 先解决后端 500

- 根据 `docker logs postiz` 中的错误定位后端问题
- 常见：数据库连接、Redis、Temporal、环境变量缺失

### 2. 检查环境变量

在 `docker-compose.yml` 中确认：

```yaml
NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4007/api'
FRONTEND_URL: 'http://localhost:4007'
```

若使用域名，需与访问地址一致。

### 3. 确保依赖服务先启动

```bash
docker compose up -d
# 等待约 30–60 秒后再访问
```

### 4. 清除缓存后重试

- 清除浏览器缓存
- 或使用无痕模式访问

---

## 六、需要你提供的信息

为精确定位问题，请提供：

1. **浏览器 Console 中的完整错误**（含堆栈）
2. **Network 中失败请求的 URL、状态码、响应内容**
3. **`docker logs postiz --tail 100` 的输出**
