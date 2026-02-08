# postiz-app + short_video + opencut-editor 三方集成方案

本文档说明如何将 **postiz-app**（多平台发布）、**short_video**（短视频生成）、**opencut-editor**（时间线编辑）三者集成，最终 **opencut-editor 嵌入 postiz-app**，实现「AI 生成 / 媒体库 → 编辑 → 多平台发布」闭环。

---

## 一、三者角色与数据流

| 项目 | 职责 | 关键输出 |
|------|------|----------|
| **postiz-app** | 主入口、多平台发布、媒体库 | Media(id, path)、Posts、Integrations |
| **short_video** | AI 视频生成、视频合成 | `video_url`、`video_sequence`（工作流内部） |
| **opencut-editor** | 时间线编辑（裁剪、拼接、字幕） | `PostizScene`（嵌入 postiz 前端） |

### 整体数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           postiz-app（主入口）                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐   │
│   │ short_video  │     │  opencut-editor     │     │  postiz 发帖      │   │
│   │ 生成 video   │ ──► │  (PostizVideoEditor │ ──► │  upload + posts   │   │
│   │              │     │   Bridge)           │     │                  │   │
│   └──────────────┘     └─────────────────────┘     └──────────────────┘   │
│          │                        ▲                          ▲             │
│          │                        │                          │             │
│          │              ┌─────────┴─────────┐                 │             │
│          │              │ postiz 媒体库      │ ────────────────┘             │
│          │              │ GET /media        │                               │
│          │              └──────────────────┘                               │
│          │                                                                  │
│          └── video_url / video_sequence（可选）                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、三种使用场景

### 场景 A：short_video 生成 → 直接发帖（已有）

```
postiz 创建帖子 → 选「short_video 生成」→ 填 idea → 调 short_video API
→ 轮询拿到 video_url → upload-from-url + posts 发到各平台
```

- **无需 opencut-editor**
- 详见 `POSTIZ_SHORT_VIDEO_FUSION_GUIDE.md`

---

### 场景 B：postiz 媒体库 → opencut-editor 编辑 → 发帖

```
用户进入 postiz 视频编辑页 → 从媒体库选素材 → opencut-editor 裁剪/拼接
→ 导出（需合成）→ 发帖
```

**postiz-app 需实现：**

| 步骤 | 实现 |
|------|------|
| 1. 视频编辑入口 | 侧边栏增加「视频编辑」，路由 `/video-editor` |
| 2. 媒体库对接 | `GET /media` → 构建 `thumbUrlByAssetId`、`getAssetUrl` 传给 bridge |
| 3. 新建场景 | 用户选媒体 → 转为 `PostizScene`（单轨多 clip） |
| 4. 编辑 | `PostizVideoEditorBridge` 渲染，`onSceneChange` 更新 scene |
| 5. 导出 | scene → 需合成服务生成 video_url → 发帖 |

**导出瓶颈**：opencut-editor 只产出 `PostizScene`（JSON），不合成视频。需：
- **方案 B1**：postiz 调 short_video 的「按 scene 合成」API（需 short_video 新增）
- **方案 B2**：postiz 后端用 FFmpeg/Remotion 按 scene 合成（需 postiz 新增）
- **方案 B3**：先不发帖，只存 scene，后续再实现合成

---

### 场景 C：short_video 生成 → 导入 opencut-editor 编辑 → 发帖

```
postiz 调 short_video 生成 → 拿到 video_sequence（需 short_video 暴露）
→ 转为 PostizScene 导入 opencut-editor → 用户二次编辑
→ 导出 scene → 调 short_video 按 scene 重新合成 → 发帖
```

**前提**：short_video 需暴露 `video_sequence`。

- 当前 short_video 任务 API 只返回 `video_url`（合成后）
- `video_sequence` 在工作流内部（`shared["video_sequence"]`），未写入 `output_data`
- **需 short_video 新增**：任务完成时把 `video_sequence` 写入 `output_data`，或新增 `GET /tasks/{id}/video_sequence` 接口

**video_sequence 格式**（short_video 内部）：

```json
[
  { "url": "https://...", "duration": 10, "position": 0, "provider": "pexels", "type": "free_video" },
  ...
]
```

**转为 PostizScene**：需 opencut-editor 提供 `videoSequenceToPostizScene` 适配器（见下节）。

---

## 三、opencut-editor 需补充的适配器

### 1. `videoSequenceToPostizScene`（short_video 用）✅ 已实现

将 short_video 的 `video_sequence` 转为 `PostizScene`：

```ts
import { videoSequenceToPostizScene, type VideoSequenceItem } from "opencut-editor";

const scene = videoSequenceToPostizScene(videoSequence, {
  sceneId: "scene-1",
  sceneName: "从 short_video 导入",
});
```

### 2. `postizSceneToVideoSequence`（导出给 short_video 合成用）✅ 已实现

将 `PostizScene` 转为 short_video 可用的 `video_sequence`：

```ts
import { postizSceneToVideoSequence } from "opencut-editor";

const sequence = postizSceneToVideoSequence(scene, (mediaId) => mediaMap[mediaId]?.url);
// 调 short_video 或 FFmpeg 按 sequence 合成
```

---

## 四、postiz-app 集成清单（最终）

| 序号 | 项 | 说明 |
|------|-----|------|
| 1 | 导航入口 | `top.menu.tsx` 增加「视频编辑」→ `/video-editor` |
| 2 | 媒体库对接 | `useSWR('/media')` → `thumbUrlByAssetId`、`getAssetUrl`（经 `mediaDirectory.set`） |
| 3 | 真实预览 | `renderPreview` + `currentClips`（桥接层已支持） |
| 4 | 场景持久化 | localStorage 或新建 VideoProject API |
| 5 | 导出/合成 | 调 short_video 合成 API，或 postiz 自建 FFmpeg 服务 |
| 6 | short_video 对接 | 创建任务、轮询、取 video_url；可选取 video_sequence 导入编辑 |

---

## 五、推荐实施顺序

1. **Phase 1**：postiz-app 内嵌 opencut-editor（媒体库 + 导航 + 预览）
   - 不依赖 short_video 的 video_sequence
   - 用户从媒体库选素材 → 编辑 → 场景存 localStorage
   - 导出暂不实现，或只支持「复制 scene JSON」

2. **Phase 2**：short_video 生成 → 直接发帖（已有方案 A）
   - 不经过 opencut-editor

3. **Phase 3**：short_video 暴露 video_sequence + opencut-editor 适配器
   - short_video 任务 API 返回 `video_sequence`
   - opencut-editor 提供 `videoSequenceToPostizScene`
   - postiz 支持「导入 short_video 任务」到编辑器

4. **Phase 4**：导出与合成
   - opencut-editor 提供 `postizSceneToVideoSequence`
   - postiz 或 short_video 提供「按 video_sequence 合成」API
   - 编辑完成后合成 → 发帖

---

## 六、关键文件索引

| 项目 | 路径 |
|------|------|
| postiz-app 视频编辑页 | `apps/frontend/src/app/(app)/(site)/video-editor/page.tsx` |
| postiz-app 媒体组件 | `apps/frontend/src/components/media/media.component.tsx` |
| postiz-app 侧边栏 | `apps/frontend/src/components/layout/top.menu.tsx` |
| opencut-editor 桥接层 | `packages/opencut-editor/src/PostizVideoEditorBridge.tsx` |
| opencut-editor postiz 适配器 | `packages/opencut-editor/src/video/adapters/postizScene.ts` |
| short_video 任务 API | `backend/app/api/v1/tasks.py` |
| short_video video_sequence | `backend/app/workflows/nodes/book/combine_and_allocate_videos_node.py` |
