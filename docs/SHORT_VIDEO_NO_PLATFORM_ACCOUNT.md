# 「暂无关联的平台账号」显示原因与排查

## 显示条件

在 **账号配置** tab 下，当 `platformAccounts.length === 0` 且加载完成时显示该提示。

## 数据来源

平台账号来自 `GET /short-video/platform-accounts?integration_id=xxx&limit=1`，代理到 short_video 的 `GET /api/v1/platform-accounts`，按 `config.postiz.integration_id` 过滤。

## 可能原因

### 1. SHORT_VIDEO_API_URL 未配置

Postiz 容器需配置 `SHORT_VIDEO_API_URL`（如 `http://host.docker.internal:8000`），否则不会请求 short_video，platform_accounts 为空。

**排查**：检查 `docker-compose.yml` 或 `.env` 中 `SHORT_VIDEO_API_URL` 是否已设置。

### 2. 连接频道时未创建 platform_account

添加频道后，`integrations.controller` 会调用 `createPlatformAccountForIntegration` 在 short_video 中创建 platform_account。若失败（网络异常、short_video 未启动等），会静默失败，仅打 `console.warn`。

**排查**：查看 Postiz 后端日志，是否有 `Failed to create short_video platform_account` 或 `ShortVideoSyncService.createPlatformAccountForIntegration failed`。

### 3. 平台不在支持列表

仅以下平台会同步到 short_video：youtube、youtube_shorts、tiktok、instagram_reels、douyin、bilibili。Twitter、LinkedIn 等不支持，不会创建 platform_account。

**排查**：确认当前集成的 provider 是否为上述之一。

### 4. 历史集成（连接在同步逻辑之前）

在添加「连接频道时创建 platform_account」逻辑之前已连接的频道，不会自动创建 platform_account。

**解决**：删除该频道后重新连接，或手动在 short_video 中创建 platform_account 并写入 `config.postiz.integration_id`。

### 5. integration_id 与 short_video 中不一致

short_video 按 `config.postiz.integration_id` 过滤。若 platform_account 的 config 中未正确写入 `postiz.integration_id`，则查不到。

**排查**：在 short_video 中执行 `SELECT id, name, config->'postiz'->>'integration_id' FROM platform_accounts;` 查看是否有对应 integration_id。

### 6. short_video 服务未启动或不可达

Postiz 请求 short_video 超时或 5xx 时，会返回空列表。

**排查**：`curl -s http://localhost:8000/health` 确认 short_video 是否正常。

## 快速检查

1. 确认 short_video 已启动：`curl -s http://localhost:8000/health`
2. 查看 Postiz 日志：`docker logs postiz 2>&1 | grep -E "getPlatformAccounts|platform_account|SHORT_VIDEO"`
3. 直接调 short_video API 查账号（把日志里的 integrationId 替换进去）：
   ```bash
   # 按 integration_id 查（你当前的 integrationId 是 cmldu4ij30001ms6lzqxseso6）
   curl -s "http://localhost:8000/api/v1/platform-accounts?integration_id=cmldu4ij30001ms6lzqxseso6&limit=5"

   # 查全部 platform_accounts，看 short_video 里有没有数据、config 里有没有 postiz.integration_id
   curl -s "http://localhost:8000/api/v1/platform-accounts?limit=20"
   ```
