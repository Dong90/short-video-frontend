# 平台账号前端字段设计（Postiz-app）

## 一、当前页面与字段使用情况

### 1.1 涉及平台账号的页面

| 页面/组件 | 路径/入口 | 用途 |
|-----------|----------|------|
| **ShortVideoIntegrationSettings** | 短视频集成配置弹窗 | 选择平台账号 + 配置短视频参数 |
| **ShortVideoInfoModal** | 集成详情 → 账号配置 Tab | 展示当前账号、人设、保存配置 |
| **ShortVideoTasksPanel** | 发帖创建 → 短视频任务 | 选择平台账号（继承配置） |

### 1.2 当前已用字段

| 字段 | 页面 | 用途 |
|------|------|------|
| `id` | 全部 | 选中标识、API 传参 |
| `name` | 全部 | 下拉选项、卡片标题 |
| `platform` | 全部 | 下拉选项「name (platform)」、平台标识 |
| `avatar_url` | IntegrationSettings、InfoModal | 头像展示（兼容 thumbnail_url 等） |

### 1.3 当前缺失

- 无「创建/编辑平台账号」入口，账号来自 short_video
- 无 account_url、description、status、persona_id 等展示
- 无平台账号切换器（集成与平台账号一对一，无需多选）

---

## 二、各页面字段设计建议

### 2.1 平台账号列表/下拉（Selector）

**使用场景**：IntegrationSettings、TasksPanel、InfoModal 内的账号选择

| 字段 | 是否展示 | 说明 |
|------|----------|------|
| `id` | 内部使用 | 选项 value |
| `name` | ✅ 主展示 | 选项文案、卡片标题 |
| `platform` | ✅ 副展示 | 例：`name (platform)` |
| `avatar_url` | ✅ 可选 | 头像（56x56），无则用平台图标 |
| `account_url` | ❌ 暂不 | 可做 tooltip「主页链接」 |
| `description` | ❌ 暂不 | 列表可省略 |
| `status` | ✅ 筛选用 | 列表默认 `status=active` |

**类型定义（前端）**：

```ts
interface PlatformAccountOption {
  id: string;
  name: string;
  platform: string;
  avatar_url?: string;
}
```

### 2.2 账号配置卡片（InfoModal 平台概览）

**使用场景**：ShortVideoInfoModal → 账号配置 Tab 顶部

| 字段 | 是否展示 | 说明 |
|------|----------|------|
| `avatar_url` | ✅ | 56x56 头像 |
| `name` | ✅ | 主标题 |
| `platform` | ✅ | 副标题 |
| `account_url` | 可选 | 可点击跳转主页 |
| `description` | 可选 | 折叠展示 |

**说明**：集成与平台账号一对一，自动匹配即可，无需切换下拉。

### 2.3 平台账号创建/编辑表单（新增场景）

**使用场景**：若在 Postiz 增加「创建/编辑平台账号」入口

| 字段 | 是否可编辑 | 说明 |
|------|------------|------|
| `name` | ✅ 必填 | 账号名称 |
| `platform` | ✅ 必填（创建） | 平台类型，编辑可禁用 |
| `account_id` | 可选 | 平台账号 ID |
| `account_url` | 可选 | 账号主页 URL |
| `avatar_url` | 可选 | 头像 URL |
| `description` | 可选 | 描述 |
| `status` | 可选 | 启用/禁用 |
| `persona_id` | 可选 | 人设选择（已有 personas API） |
| `external_ids` | 高级 | channel_id、internal_id、user_id |
| `credentials` | 高级 | access_token、refresh_token（密码框） |
| `postiz` | 系统填 | organization_id、integration_id 由后端注入 |

**分组建议**：

- **基本信息**：name、platform、account_id、account_url、avatar_url、description、status
- **人设**：persona_id
- **集成关联**（高级）：external_ids、credentials、postiz

### 2.4 任务创建时的平台账号选择（TasksPanel）

**使用场景**：short-video.tasks.panel 下拉

| 字段 | 是否展示 | 说明 |
|------|----------|------|
| `id` | 内部 | value |
| `name` | ✅ | 主文案 |
| `platform` | ✅ | 副文案 |
| `avatar_url` | 可选 | 下拉可带小头像 |

---

## 三、统一字段映射（API → 前端）

| API 响应字段 | 前端展示名 | 建议用法 |
|--------------|------------|----------|
| `id` | - | 唯一标识 |
| `name` | 账号名称 | 主展示 |
| `platform` | 平台 | 副展示 |
| `avatar_url` | 头像 | 头像/占位 |
| `account_url` | 主页链接 | 可选展示 |
| `description` | 描述 | 详情/折叠 |
| `status` | 状态 | 筛选用 |
| `persona_id` | 人设 | 详情/编辑 |
| `config` | - | 通过 integration-config 管理 |

| API 响应字段 | 前端 | 说明 |
|--------------|------|------|
| `external_ids` | 高级编辑 | 一般不展示 |
| `postiz` | 系统 | 后端自动填充 |
| `credentials` | 不展示 | 安全，不返回 |

---

## 四、实施优先级建议

| 优先级 | 改动 | 说明 |
|--------|------|------|
| P0 | 列表/下拉统一用 `PlatformAccountOption` | id、name、platform、avatar_url |
| P1 | 列表/卡片展示 account_url、description | 可选链接、描述 |
| P2 | 新增「创建/编辑平台账号」表单 | 视产品需求 |

---

## 五、后端支持概况（short_video）

`PUT /api/v1/platform-accounts/:id` 支持**部分更新**，所有字段均为可选，只传需要改动的字段即可。

### 5.1 可更新字段总览

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 账号名称（1-200 字符） |
| `platform` | string | 平台类型（变更时会应用新平台默认值） |
| `account_id` | string | 平台账号 ID |
| `account_url` | string | 账号主页 URL |
| `status` | string | 状态：`active` / `inactive` |
| `avatar_url` | string | 头像 URL |
| `description` | string | 账号描述 |
| `persona_id` | string (UUID) | 关联人设 ID，`null` 表示解除关联 |
| `external_ids` | object | 平台外部 ID 集合 |
| `credentials` | object | OAuth 凭证（响应中不返回） |
| `postiz` | object | Postiz 集成关联 |
| `config` | object | 账号配置（短视频生成参数等） |
| `tags` | string[] | 标签列表 |

### 5.2 嵌套结构

```ts
// external_ids
{
  channel_id?: string;
  internal_id?: string;
  user_id?: string;
}

// credentials（敏感，仅用于更新）
{
  access_token?: string;
  refresh_token?: string;
}

// postiz
{
  organization_id?: string;
  integration_id?: string;
}

// config（与 integration-config 一致）
{
  persona_id?: string;
  platform_account_id?: string;
  use_free_videos?: boolean;
  // ... 其他短视频生成参数
}
```

---

## 六、Postiz-app 当前 API 使用方式

### 6.1 现有调用

| 场景 | 文件 | 更新内容 |
|------|------|----------|
| 保存 integration-config | `short-video.controller.ts` | `{ config: accountConfig }` |
| 保存人设到账号 | `short-video-info.modal.tsx` | 通过 `POST /integration-config` 间接更新（含 `persona_id`） |

### 6.2 流程说明

1. **保存短视频配置**：`POST /api/short-video/integration-config`  
   body 含 `platform_account_id` 和完整 config  
   → 后端保存到 Sets 后，再调用 `PUT /api/v1/platform-accounts/:id` 传 `{ config }` 同步到 short_video。

2. **人设关联**：通过 `integration-config` 的 `persona_id` 字段保存，最终落到 platform_account 的 `config` 中。

---

## 七、Postiz-app 推荐更新字段设计

### 7.1 按场景划分

| 场景 | 推荐更新字段 | 说明 |
|------|--------------|------|
| **短视频配置** | `config` | 保持现状，与 integration-config 一致 |
| **人设绑定** | `persona_id` 或 `config.persona_id` | 统一建议用顶层 `persona_id` |
| **Postiz 绑定** | `postiz` | 新建/连接账号时写入 `organization_id`、`integration_id` |
| **OAuth 凭证** | `credentials` | OAuth 回调时更新 `access_token`、`refresh_token` |
| **基础信息** | `name`、`avatar_url`、`description` | 账号详情页编辑 |
| **外部 ID** | `external_ids` | 从平台 API 拉取后回写 |

### 7.2 推荐请求体结构（按需传）

```typescript
// 1. 仅更新 config（现有逻辑）
{ config: { use_free_videos: true, persona_id: "...", ... } }

// 2. 绑定 Postiz 集成（OAuth 连接后）
{
  postiz: { organization_id: "org_xxx", integration_id: "int_yyy" },
  external_ids: { channel_id: "...", user_id: "..." },
  credentials: { access_token: "...", refresh_token: "..." }
}

// 3. 更新人设
{ persona_id: "uuid" }  // 或 null 解除

// 4. 更新基础信息
{ name: "...", avatar_url: "...", description: "..." }
```

### 7.3 与 integration-config 的职责划分

| 存储位置 | 内容 | 更新入口 |
|----------|------|----------|
| **Sets (integration-config)** | postiz 组织内短视频配置（含 persona_id），可含 UI 临时字段 | `POST /api/short-video/integration-config` |
| **platform_account** | short_video 侧账号实体，含 config、postiz、credentials 等 | `PUT /api/v1/platform-accounts/:id` |

建议：保存 integration-config 时，继续同步 `config` 到 platform_account；如需更新 `persona_id` 顶层字段，可一并传 `persona_id`，避免与 `config.persona_id` 重复。

---

## 八、TypeScript 类型定义（供 postiz-app 使用）

```typescript
// 平台账号更新请求
interface PlatformAccountUpdateRequest {
  name?: string;
  platform?: string;
  account_id?: string;
  account_url?: string;
  status?: 'active' | 'inactive';
  avatar_url?: string;
  description?: string;
  persona_id?: string | null;  // UUID 或 null
  external_ids?: {
    channel_id?: string;
    internal_id?: string;
    user_id?: string;
  };
  credentials?: {
    access_token?: string;
    refresh_token?: string;
  };
  postiz?: {
    organization_id?: string;
    integration_id?: string;
  };
  config?: Record<string, unknown>;
  tags?: string[];
}
```

---

## 九、总结

- **PUT 支持字段**：上述 12 个顶层字段 + 嵌套结构，均为可选。
- **postiz 当前**：主要用 `config` 同步 integration-config。
- **可扩展**：OAuth 连接后可更新 `postiz`、`credentials`、`external_ids`；人设可统一用顶层 `persona_id`。

---

## 十、需求满足度分析

### 10.1 已满足需求 ✅

| 需求 | 满足方式 |
|------|----------|
| 平台账号列表 | GET /platform-accounts 代理，status=active 过滤 |
| 平台账号选择 | IntegrationSettings、TasksPanel、InfoModal 下拉 |
| 短视频配置保存 | POST /integration-config → 同步 config 到 PUT |
| 人设绑定到账号 | integration-config 含 persona_id，落到 config |
| 任务创建带账号 | platform_account_id 传 short_video |
| 头像展示 | avatar_url（兼容 thumbnail_url 等） |
| 基础字段展示 | name、platform、avatar_url |

### 10.2 部分满足 / 待补齐 ⚠️

| 需求 | 现状 | 建议 |
|------|------|------|
| **persona_id 顶层** | 当前存 config，文档建议用顶层 | 保存 integration-config 时，同时 PUT `{ persona_id }` 到 platform_account |
| **账号切换** | 集成与平台账号一对一 | 无需切换，自动匹配即可 |
| **account_url / description** | 未展示 | P2：卡片可选展示 |
| **TasksPanel avatar_url** | 列表只有 id/name/platform | 可选：下拉带小头像 |

### 10.3 未覆盖 / 需扩展 ❌

| 需求 | 说明 | 建议 |
|------|------|------|
| **平台账号删除** | short_video 有 DELETE，postiz 未代理 | 若需在 Postiz 删除账号，增加 `DELETE /api/short-video/platform-accounts/:id` 代理 |
| **Postiz 内创建账号** | 无入口，账号来自 short_video | 若要做「连接账号」OAuth 流程，需新增创建页 + POST 代理 |
| **OAuth 连接后写 postiz/credentials** | 文档有设计，无实现 | OAuth 回调时调用 PUT 写入 `postiz`、`credentials`、`external_ids` |
| **平台账号编辑（基础信息）** | 无 name/avatar_url/description 编辑入口 | P3：新增编辑表单或弹窗 |

### 10.4 结论

| 场景 | 能否满足 |
|------|----------|
| **当前 Postiz 短视频流程** | ✅ 能满足（选择账号、配置、人设、任务创建） |
| **账号选择** | ✅ 集成与平台账号一对一，自动匹配即可 |
| **人设与顶层 persona_id 统一** | ⚠️ 需改 saveIntegrationConfig 双写 |
| **在 Postiz 内增删改平台账号** | ❌ 需新增代理 + 前端入口 |
| **OAuth 连接后自动创建/更新账号** | ❌ 需新增流程与实现 |

**总体**：文档能满足当前「选账号 + 配短视频 + 人设 + 发任务」的主流程。若要做「在 Postiz 内完整管理平台账号」或「OAuth 连接自动建号」，需按 10.3 补充实现。
