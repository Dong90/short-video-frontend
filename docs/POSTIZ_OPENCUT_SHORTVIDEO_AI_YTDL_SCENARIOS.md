# postiz + opencut-editor + short_video：AI 与 YT-DL 应用场景

本文档描述 **postiz-app**、**opencut-editor**、**short_video** 三者结合 AI 与 YT-DL 的典型应用场景，以及各项目需承担的职责。包含接口定义、数据流、代码示例和依赖关系。

---

## 一、三者角色与依赖关系

### 1.1 职责与能力

| 项目 | 职责 | 关键能力 | 依赖 |
|------|------|----------|------|
| **postiz-app** | 主入口、多平台发布、媒体库、用户界面 | 发帖、媒体管理、视频编辑页 | 依赖 opencut-editor（npm）；调用 short_video API |
| **opencut-editor** | 时间线编辑、剪辑、混剪、AI 钩子 | PostizScene、onRequestAIAction、assetAPI | 无项目依赖，纯前端库 |
| **short_video** | AI 视频生成、合成、yt-dlp 素材获取 | video_sequence、FFmpeg、Remotion、yt-dlp | 被 postiz 调用；可被 postiz 后端调用 |

### 1.2 数据流与调用关系

```
                    postiz-app（主入口）
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────────┐   ┌──────────────┐
   │ 媒体库    │     │ opencut-     │   │ short_video   │
   │ GET      │◄────│ editor       │   │ 任务 API      │
   │ /media   │     │ (嵌入)       │   │ POST /tasks   │
   └────┬─────┘     └──────┬───────┘   └──────┬───────┘
        │                  │                  │
        │  getAssetUrl      │ assetAPI         │ video_sequence
        │  thumbUrlByAssetId│ importFromUrl    │ 合成
        │                  │ onRequestAIAction│
        └──────────────────┴──────────────────┘
```

### 1.3 核心数据结构

**VideoAsset**（opencut-editor 定义，postiz/short_video 需兼容）

```ts
interface VideoAsset {
  id: string;
  url: string;
  type: "video" | "image" | "audio";
  duration?: number;
  metadata?: Record<string, any>;
}
```

**PostizScene**（opencut-editor 定义，postiz 持有）

```ts
interface PostizScene {
  id: string;
  name: string;
  isMain: boolean;
  tracks: { id: string; name: string; type: string; elements: TimelineElement[] }[];
  bookmarks: number[];
  createdAt: Date;
  updatedAt: Date;
}
```

**VideoSequenceItem**（short_video 与 opencut-editor 共用）

```ts
interface VideoSequenceItem {
  url: string;           // 视频/音频可访问 URL
  duration: number;      // 片段时长（秒）
  position?: number;     // 0~1 比例，在总时长中的位置
  provider?: string;    // 来源：pexels、bilibili、youtube 等
  type?: string;        // free_video、audio 等
  // short_video 内部可能还有：
  subtitle_index?: number;
  is_core_hit?: boolean;
  match_score?: number;
}
```

**TimelineElement**（PostizScene 内单轨元素）

```ts
interface VideoElement {
  id: string;
  type: "video" | "image" | "audio" | "text" | "sticker";
  mediaId?: string;     // 引用媒体库 ID
  sourceUrl?: string;   // 或直接 URL（audio 轨）
  startTime: number;    // 时间线起始（秒）
  duration: number;
  trimStart: number;    // 素材内裁剪起点
  trimEnd: number;      // 素材内裁剪终点
}
```

### 1.4 项目目录结构（便于定位）

```
postiz-app/
├── apps/frontend/src/app/(app)/(site)/video-editor/   # 视频编辑页
├── apps/backend/src/api/routes/media.controller.ts   # 媒体 API（需扩展 import-from-url）
└── libraries/nestjs-libraries/.../media/              # 媒体服务

opencut-editor/
├── packages/opencut-editor/src/
│   ├── PostizVideoEditorBridge.tsx
│   ├── video/OpenCutVideoEditor.tsx
│   └── video/adapters/
│       ├── assetImport.ts
│       ├── shortVideo.ts
│       └── postizScene.ts

short_video/
├── backend/app/
│   ├── api/v1/tasks.py                    # 任务 API
│   └── workflows/nodes/book/
│       ├── combine_and_allocate_videos_node.py   # 产出 video_sequence
│       └── compose_video_from_videos_node.py    # FFmpeg 合成
└── docs/YT_DLP_FFMPEG_REMOTION_INTEGRATION.md
```

---

## 二、AI 应用场景（结合三者）

### 2.1 内容获取与理解

| 场景 | 流程 | postiz | opencut-editor | short_video |
|------|------|--------|----------------|-------------|
| **智能素材发现** | YT-DL 拉取 → AI 分析画面/语音 → 打标签 | 媒体库展示、筛选 | - | AI 分析节点（可扩展） |
| **多语言内容理解** | 下载视频 → AI 转录/翻译 → 多语言字幕 | 发帖到多语言平台 | aiTranslate 工具 | TTS/转录（已有） |
| **版权与合规检测** | AI 识别 BGM、人脸、品牌 | 发帖前校验 | - | 分析节点（可扩展） |

**多语言字幕实现要点**：

- opencut-editor 暴露 `tools.aiTranslate: true`，用户点击「翻译字幕」时触发 `onRequestAIAction({ type: "aiTranslate", range: { start, end } })`
- postiz 实现回调：调用 AI 翻译 API → 返回新字幕文本 → 需扩展 opencut-editor 支持「写入字幕」或由 postiz 直接更新 scene 中 text 轨

### 2.2 自动化剪辑

| 场景 | 流程 | postiz | opencut-editor | short_video |
|------|------|--------|----------------|-------------|
| **AI 自动粗剪** | 根据脚本/字幕切分，去掉静音、口误 | 触发任务 | onRequestAIAction("auto-cut") | 粗剪逻辑（可扩展） |
| **智能转场** | AI 识别场景切换点 → 自动加转场 | - | 时间线操作 | - |
| **一键成片** | 输入主题 → AI 选素材 → 生成 → 编辑 | 创建帖子、选「AI 生成」 | 导入 video_sequence 编辑 | 生成 video、video_sequence |

**AI 粗剪实现要点**：

```ts
// postiz 实现 onRequestAIAction
onRequestAIAction: async (payload) => {
  if (payload.type === "auto-cut") {
    const { range } = payload;  // 可选：只处理选中范围
    const result = await fetch("/api/ai/auto-cut", {
      method: "POST",
      body: JSON.stringify({ scene, range }),
    }).then(r => r.json());
    // result: { cutPoints: number[] } 建议切分点
    setScene(applyCutPoints(scene, result.cutPoints));
  }
}
```

### 2.3 混剪与二次创作

| 场景 | 流程 | postiz | opencut-editor | short_video |
|------|------|--------|----------------|-------------|
| **热点混剪** | 爬取热门 → AI 提取金句/高光 → 混剪 | 发帖 | 剪辑、postizSceneToVideoSequence | 合成、yt-dlp 下载 |
| **教程/课程切片** | YT-DL 下载长课 → AI 按章节切分 | 媒体库、发帖 | 导入、裁剪 | 合成 |
| **播客切片** | 下载播客 → AI 识别笑点/金句 → 短视频 | 发帖 | 剪辑 | 合成、yt-dlp |

**教程切片流程（详细）**：

1. 用户粘贴课程 URL → postiz 调用 `assetAPI.importFromUrl(url)` → 后端 yt-dlp 下载 → 返回 VideoAsset
2. postiz 调用 `createVideoElementFromAsset(asset, 0)`、`appendVideoToScene(scene, el)` 加入时间线
3. 用户点击「AI 按章节切分」→ `onRequestAIAction({ type: "auto-cut" })` → 后端 AI 分析章节 → 返回切分点
4. postiz 根据切分点更新 scene（或拆成多个 clip）
5. 导出：`postizSceneToVideoSequence(scene, getAssetUrl)` → 调 short_video 合成 API → 发帖

### 2.4 多平台发布

| 场景 | 流程 | postiz | opencut-editor | short_video |
|------|------|--------|----------------|-------------|
| **一键多平台** | 从 YouTube 拉取 → AI 重剪适配各平台 → 发布 | 多平台发帖（核心） | 不同比例/时长裁剪 | 按 platform 合成 |
| **智能封面** | AI 选关键帧 → 生成封面、标题、标签 | 发帖时填充 | - | 分析节点（可扩展） |

---

## 三、YT-DL 应用场景（结合三者）

### 3.1 素材导入

| 场景 | 流程 | 职责分工 |
|------|------|----------|
| **从链接导入到编辑器** | 用户粘贴 URL → 下载 → 加入时间线 | postiz：UI、调用 assetAPI；opencut-editor：createVideoElementFromAsset、appendVideoToScene；short_video 或 postiz 后端：yt-dlp 下载 |
| **BGM 从 YouTube 获取** | 任务配置 bgm_url → yt-dlp 下载 → 合成 | short_video：FetchMediaWithYtDlpNode（见 YT_DLP_FFMPEG_REMOTION_INTEGRATION.md） |
| **视频片段从 B 站/YouTube** | 配置 video_sources → yt-dlp 下载 → 作为 free_videos | short_video：扩展 yt-dlp 节点 |

### 3.2 从链接导入到编辑器（完整流程）

```
用户点击「从链接导入」→ 输入 URL
        │
        ▼
postiz 调用 assetAPI.importFromUrl(url, "video")
        │
        ▼
postiz 后端 API：POST /api/media/import-from-url { url }
        │
        ├── 1. 调 yt-dlp：yt-dlp -f "best[ext=mp4]" -o "/tmp/%(id)s.%(ext)s" <url>
        ├── 2. ffprobe 获取 duration
        ├── 3. 上传到媒体库，得到 media.id、media.path
        └── 4. 返回 VideoAsset { id, url, type: "video", duration }
        │
        ▼
postiz 前端收到 asset，调用：
  const startTime = getSceneEndTime(scene);
  const el = createVideoElementFromAsset(asset, startTime);
  const next = appendVideoToScene(scene, el);
  setScene(next);
        │
        ▼
PostizVideoEditorBridge 内部 timeline 更新，用户可继续剪辑
```

### 3.3 AssetSourceAPI 接口定义

```ts
// opencut-editor 定义，postiz 实现
interface AssetSourceAPI {
  listAssets?: (query?: { type?: "video"|"image"|"audio"; q?: string }) => Promise<VideoAsset[]>;
  uploadAsset?: (file: File, type: "video"|"image"|"audio") => Promise<VideoAsset>;
  importFromUrl?: (url: string, type: "video"|"image"|"audio") => Promise<VideoAsset>;
}
```

**importFromUrl 实现示例（postiz 后端）**：

```ts
// 伪代码：postiz apps/backend 或 short_video 提供
async function importFromUrl(url: string, type: string): Promise<VideoAsset> {
  const tmpPath = await runYtDlp(url, type);  // yt-dlp -x 用于 audio
  const duration = await getDuration(tmpPath);  // ffprobe
  const media = await uploadToMediaLibrary(tmpPath);
  return { id: media.id, url: media.url, type, duration };
}
```

### 3.4 short_video 内 yt-dlp 数据流

```
任务配置 yt_dlp: { bgm_url, video_sources }
        │
        ▼
FetchMediaWithYtDlpNode（short_video 工作流节点）
        │
        ├── bgm_url → yt-dlp -x --audio-format mp3 → shared["bgm_local_path"]
        └── video_sources → 下载到本地 → 写入 shared["free_videos"] 或 video_sequence
        │
        ▼
ComposeVideoFromVideosNode / ComposeRemotionVideoNode 使用
```

### 3.5 yt-dlp 命令示例（postiz 后端实现参考）

```bash
# 视频下载（最佳 mp4）
yt-dlp -f "best[ext=mp4]/best" -o "/tmp/%(id)s.%(ext)s" "https://www.youtube.com/watch?v=xxx"

# 音频提取（BGM）
yt-dlp -x --audio-format mp3 -o "/tmp/%(id)s.%(ext)s" "https://www.youtube.com/watch?v=xxx"

# 指定起止时间（裁剪）
yt-dlp --download-sections "*30-150" -f "best" -o "/tmp/%(id)s.%(ext)s" "https://..."

# 获取 duration（ffprobe）
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /tmp/xxx.mp4
```

### 3.6 支持的 URL 平台（yt-dlp）

| 平台 | 示例 URL | 备注 |
|------|----------|------|
| YouTube | https://www.youtube.com/watch?v=xxx | 需遵守 ToS |
| B 站 | https://www.bilibili.com/video/BVxxx | |
| SoundCloud | https://soundcloud.com/xxx | 常用于 BGM |
| 抖音/快手 | 视 yt-dlp 版本支持 | 可能需 cookie |
| 通用 | 任何 yt-dlp 支持的站点 | 见 yt-dlp 文档 |

---

## 四、各项目对接点（详细）

### 4.1 postiz-app

| 对接点 | 说明 | 实现状态 | 相关文件 |
|--------|------|----------|----------|
| 视频编辑页 | 嵌入 PostizVideoEditorBridge，提供 assetAPI、onRequestAIAction | 基础已有 | `apps/frontend/src/app/(app)/(site)/video-editor/page.tsx` |
| assetAPI.importFromUrl | 调用后端 yt-dlp 下载，返回 VideoAsset | 需新增 | 需新增 `POST /api/media/import-from-url` + 前端调用 |
| onRequestAIAction | 对接 AI 服务（字幕、翻译、BGM、粗剪） | 需实现 | 回调内调用 AI API，根据 type 分发 |
| getAssetUrl | mediaId → 可播放 URL | 需对接媒体库 | 从 mediaDirectory 或 GET /media 解析 |
| thumbUrlByAssetId | mediaId → 缩略图 URL | 需对接媒体库 | 同上 |
| 发帖 | 编辑完成 → 合成 → 多平台发布 | 已有 | post 相关 API |

**postiz 视频编辑页最小集成示例**：

```tsx
// video-editor/page.tsx 关键 props
<PostizVideoEditorBridge
  scene={scene}
  onSceneChange={setScene}
  getAssetUrl={(id) => mediaMap[id]?.url}
  thumbUrlByAssetId={thumbUrlByAssetId}
  assetAPI={{
    importFromUrl: async (url, type) => {
      const res = await fetch("/api/media/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  }}
  onRequestAIAction={async (payload) => {
    // 根据 payload.type 调用不同 AI 服务
  }}
  children={<ImportFromUrlButton onImport={handleImportFromUrl} />}
/>
```

**ImportFromUrlButton 组件示例**：

```tsx
// 需 import：createVideoElementFromAsset, appendVideoToScene, getSceneEndTime from "opencut-editor"
// 需 import：AssetSourceAPI, PostizScene
// 可放在 children 插槽或编辑页顶部
function ImportFromUrlButton({
  assetAPI,
  scene,
  onSceneChange,
}: {
  assetAPI?: AssetSourceAPI;
  scene: PostizScene;
  onSceneChange: (s: PostizScene) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!assetAPI?.importFromUrl || !url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const asset = await assetAPI.importFromUrl(url.trim(), "video");
      const startTime = getSceneEndTime(scene);
      const el = createVideoElementFromAsset(asset, startTime);
      onSceneChange(appendVideoToScene(scene, el));
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="粘贴视频链接" />
      <button onClick={handleImport} disabled={loading}>从链接导入</button>
      {error && <span>{error}</span>}
    </div>
  );
}
```

### 4.2 opencut-editor

| 对接点 | 说明 | 实现状态 | 相关文件 |
|--------|------|----------|----------|
| PostizVideoEditorBridge | 桥接 PostizScene ↔ TimelineState | 已实现 | `packages/opencut-editor/src/PostizVideoEditorBridge.tsx` |
| assetAPI | listAssets、uploadAsset、importFromUrl 接口定义 | 已定义 | `OpenCutVideoEditor.tsx` L215-228 |
| onRequestAIAction | 透传 AI 请求 | 已透传 | payload: `{ type, range? }` |
| tools | aiCaption、aiTranslate、aiBgm 开关 | 已支持 | ToolConfig |
| assetImport | createVideoElementFromAsset、appendVideoToScene、getSceneEndTime | 已实现 | `video/adapters/assetImport.ts` |
| shortVideo 适配器 | videoSequenceToPostizScene、postizSceneToVideoSequence | 已实现 | `video/adapters/shortVideo.ts` |

**opencut-editor 导出**：

```ts
import {
  PostizVideoEditorBridge,
  videoSequenceToPostizScene,
  postizSceneToVideoSequence,
  createVideoElementFromAsset,
  appendVideoToScene,
  getSceneEndTime,
} from "opencut-editor";
```

### 4.3 short_video

| 对接点 | 说明 | 实现状态 | 相关文件 |
|--------|------|----------|----------|
| 任务 API | POST /tasks 创建，GET /tasks/:id 轮询 | 已有 | `backend/app/api/v1/tasks.py` |
| video_url | 任务完成后的合成视频 URL | 已有 | output_data |
| video_sequence | 工作流内部片段列表 | 内部有，未暴露 | 需写入 output_data 或新增接口 |
| yt-dlp 节点 | FetchMediaWithYtDlpNode | 文档有方案 | `docs/YT_DLP_FFMPEG_REMOTION_INTEGRATION.md` |
| 按 scene 合成 API | 接收 video_sequence，FFmpeg/Remotion 合成 | 需新增 | 可复用现有 ComposeVideoFromVideosNode 逻辑 |

**short_video 需新增**：

1. 任务 API 返回 `video_sequence`（与 video_url 并列）

   - **实现位置**：`compose_video_from_videos_node.py` 约 L3052-3063，在 `task.output_data` 赋值处增加：
     ```python
     video_seq = shared.get("video_sequence") or []
     if video_seq:
         task.output_data["video_sequence"] = video_seq
     ```
   - `ComposeRemotionVideoNode` 同理，在写入 video_url 时一并写入 video_sequence（图片模式可能无 video_sequence，可写空数组）
2. `POST /api/v1/compose`：接收 `{ video_sequence: VideoSequenceItem[] }`，返回合成后的 video_url

### 4.4 API 规格（需新增接口）

**POST /api/media/import-from-url**（postiz 或 short_video 提供）

| 项目 | 说明 |
|------|------|
| 请求 | `{ "url": string, "type": "video" \| "image" \| "audio" }` |
| 响应 | `VideoAsset { id, url, type, duration?, metadata? }` |
| 错误 | 400 无效 URL；404 资源不存在；500 yt-dlp/ffprobe 失败 |
| 超时 | 建议 120s（长视频下载） |

**GET /api/v1/tasks/:id**（short_video 扩展）

在 `output_data` 中增加 `video_sequence` 字段，格式同 `VideoSequenceItem[]`。

**POST /api/v1/compose**（short_video 新增）

| 项目 | 说明 |
|------|------|
| 请求 | `{ "video_sequence": VideoSequenceItem[], "subtitle_srt_url"?: string }` |
| 响应 | `{ "video_url": string }` |
| 实现 | 复用 ComposeVideoFromVideosNode 的 FFmpeg 逻辑，或新建独立服务 |

### 4.5 postiz 媒体 API 现状

| 接口 | 方法 | 说明 |
|------|------|------|
| GET /media | GET | 分页获取媒体列表，返回 `{ path, ... }` |
| POST /media/upload-server | POST | 上传文件 |
| POST /media/save-media | POST | 保存 URL 到媒体库 |
| POST /media/import-from-url | - | **需新增**：yt-dlp 下载后保存 |

---

## 五、场景依赖关系

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景：从链接导入 → 剪辑 → 导出发帖                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  postiz 提供           opencut-editor 提供        short_video 提供           │
│  ─────────────         ──────────────────        ─────────────────           │
│  • 从链接导入 UI         • createVideoElement     • （可选）importFromUrl     │
│  • assetAPI.importFromUrl   FromAsset              后端实现                   │
│  • getAssetUrl           • appendVideoToScene    • 按 scene 合成 API          │
│  • thumbUrlByAssetId     • postizSceneToVideo    • video_sequence 格式       │
│  • 发帖到多平台             Sequence                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景：short_video AI 生成 → 导入编辑 → 发帖                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  short_video 提供        opencut-editor 提供       postiz 提供                │
│  ─────────────────      ──────────────────        ─────────────               │
│  • video_sequence 暴露    • videoSequenceTo        • 导入 short_video 任务 UI │
│  • 任务 API 返回           PostizScene             • 发帖                     │
│  • 按 scene 重新合成     • PostizVideoEditorBridge                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 场景：AI 字幕 / 翻译 / 粗剪                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  opencut-editor 触发     postiz 实现              AI 服务                    │
│  ─────────────────      ─────────────            ─────────                  │
│  • onRequestAIAction     • 回调内调用 AI API      •  Whisper/大模型/等        │
│  • tools.aiCaption       • 将结果写回 scene       •  返回字幕/切分点          │
│  • tools.aiTranslate     • 或更新 timeline                                   │
│  • tools.aiBgm                                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、推荐实施顺序

| 阶段 | 内容 | 涉及项目 | 前置依赖 |
|------|------|----------|----------|
| **Phase 1** | postiz 视频编辑页 + 媒体库 + opencut-editor 基础剪辑 | postiz、opencut-editor | 无 |
| **Phase 2** | assetAPI.importFromUrl + 从链接导入 UI（yt-dlp 后端） | postiz、short_video 或 postiz 后端 | Phase 1 |
| **Phase 3** | short_video 暴露 video_sequence，postiz 支持「导入 short_video 任务」 | short_video、postiz、opencut-editor | Phase 1 |
| **Phase 4** | 导出合成：postizSceneToVideoSequence → short_video 合成 API | short_video、postiz | Phase 1, 3 |
| **Phase 5** | onRequestAIAction 对接 AI：字幕、翻译、BGM、粗剪 | postiz、AI 服务 | Phase 1 |
| **Phase 6** | short_video 完善 yt-dlp 节点（BGM、视频片段） | short_video | 可并行 |

### 6.1 Phase 1 任务清单（postiz + opencut-editor）

| 序号 | 任务 | 负责 | 验收 |
|------|------|------|------|
| 1.1 | postiz 侧边栏增加「视频编辑」入口，路由 `/video-editor` | postiz | 点击可进入编辑页 |
| 1.2 | 视频编辑页嵌入 PostizVideoEditorBridge，传入 scene/onSceneChange | postiz | 时间线可渲染 |
| 1.3 | 对接媒体库：GET /media → thumbUrlByAssetId、getAssetUrl | postiz | 素材缩略图、预览可显示 |
| 1.4 | 新建场景：用户从媒体库选素材 → 转为 PostizScene | postiz | 可创建多 clip 场景 |
| 1.5 | 场景持久化：localStorage 或 VideoProject API | postiz | 刷新不丢失 |

### 6.2 Phase 2 任务清单（从链接导入）

| 序号 | 任务 | 负责 | 验收 |
|------|------|------|------|
| 2.1 | postiz 后端新增 POST /api/media/import-from-url | postiz | 调 yt-dlp 下载，返回 VideoAsset |
| 2.2 | 前端 assetAPI.importFromUrl 调用该 API | postiz | 可传入 URL 得到 asset |
| 2.3 | 前端「从链接导入」按钮：输入 URL → 调用 importFromUrl → createVideoElementFromAsset → appendVideoToScene | postiz | 导入后时间线出现新片段 |
| 2.4 | 错误处理：下载失败、超时、无效 URL 的提示 | postiz | 用户可见错误信息 |

### 6.3 Phase 3 任务清单（short_video 导入编辑）

| 序号 | 任务 | 负责 | 验收 |
|------|------|------|------|
| 3.1 | short_video 任务完成时，将 shared["video_sequence"] 写入 task.output_data | short_video | GET /tasks/:id 返回 video_sequence |
| 3.2 | postiz 视频编辑页增加「从 short_video 任务导入」入口 | postiz | 可选任务 ID，拉取 video_sequence |
| 3.3 | 调用 videoSequenceToPostizScene 转为 scene，setScene | postiz | 时间线展示 short_video 生成结果 |

### 6.4 Phase 4 任务清单（导出合成）

| 序号 | 任务 | 负责 | 验收 |
|------|------|------|------|
| 4.1 | short_video 新增 POST /api/v1/compose，接收 video_sequence | short_video | 返回合成后的 video_url |
| 4.2 | postiz 导出按钮：postizSceneToVideoSequence → 调 compose API | postiz | 得到最终视频 URL |
| 4.3 | 发帖流程：导出 video_url → 多平台发布 | postiz | 可发到 YouTube、抖音等 |

### 6.5 Phase 5 任务清单（AI 能力）

| 序号 | 任务 | 负责 | 验收 |
|------|------|------|------|
| 5.1 | postiz 实现 onRequestAIAction，根据 type 分发 | postiz | auto-caption、aiTranslate、aiBgm、auto-cut |
| 5.2 | auto-caption：调用 Whisper/大模型 → 返回字幕 → 写回 scene | postiz + AI | 时间线出现字幕轨 |
| 5.3 | aiTranslate：翻译选中字幕 → 更新 text 轨 | postiz + AI | 多语言字幕 |
| 5.4 | aiBgm：根据内容推荐 BGM → importFromUrl 下载 → 加入音频轨 | postiz + AI | 可加 BGM |
| 5.5 | auto-cut：AI 分析静音/口误 → 返回切分点 → 更新 scene | postiz + AI | 粗剪完成 |

---

## 七、错误处理与边界情况

| 场景 | 处理方式 |
|------|----------|
| importFromUrl 超时 | 设置 120s 超时，返回 504，前端提示「下载超时，请换短视频或稍后重试」 |
| yt-dlp 不支持 URL | 返回 400，前端提示「暂不支持该链接」 |
| 媒体库 getAssetUrl 返回空 | opencut-editor 预览区无法播放，可显示占位图 |
| scene 为空时 getSceneEndTime | 返回 0，appendVideoToScene 会新建视频轨 |
| short_video 任务未完成 | video_sequence 为空，导入时提示「任务尚未完成」 |
| compose API 失败 | 返回 500，前端提示「合成失败，请检查素材是否可访问」 |

---

## 八、环境与依赖

| 项目 | 依赖 |
|------|------|
| postiz 后端（import-from-url） | yt-dlp、ffprobe（ffmpeg）、足够磁盘空间 |
| short_video | 已有 FFmpeg、Remotion；需安装 yt-dlp（`pip install yt-dlp`） |
| opencut-editor | 无额外依赖，纯前端 |

---

## 九、相关文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 三方集成方案 | `postiz-app/docs/POSTIZ_SHORT_VIDEO_OPENCUT_INTEGRATION.md` | 基础数据流与场景 |
| 剪辑/混剪/YT-DL | `postiz-app/docs/POSTIZ_EDITING_MIXING_YTDL.md` | 剪辑、混剪、importFromUrl 实现 |
| yt-dlp + FFmpeg + Remotion | `short_video/docs/YT_DLP_FFMPEG_REMOTION_INTEGRATION.md` | short_video 内 yt-dlp 集成 |
| postiz + short_video 融合 | `short_video/docs/POSTIZ_SHORT_VIDEO_FUSION_GUIDE.md` | 发帖流程 |

---

## 十、关键文件索引

| 项目 | 路径 |
|------|------|
| **postiz-app** | |
| 视频编辑页 | `apps/frontend/src/app/(app)/(site)/video-editor/page.tsx` |
| 媒体组件 | `apps/frontend/src/components/media/media.component.tsx` |
| **opencut-editor** | |
| 桥接层 | `packages/opencut-editor/src/PostizVideoEditorBridge.tsx` |
| 编辑器 | `packages/opencut-editor/src/video/OpenCutVideoEditor.tsx` |
| assetImport 适配器 | `packages/opencut-editor/src/video/adapters/assetImport.ts` |
| shortVideo 适配器 | `packages/opencut-editor/src/video/adapters/shortVideo.ts` |
| **short_video** | |
| 任务 API | `backend/app/api/v1/tasks.py` |
| 视频合成节点 | `backend/app/workflows/nodes/book/combine_and_allocate_videos_node.py` |
| Remotion 合成 | `backend/remotion_project/` |
