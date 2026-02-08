# postiz-app 视频编辑器集成清单

## 一、当前状态

- ✅ `/video-editor` 页面已创建，使用 `PostizVideoEditorBridge`
- ✅ `opencut-editor` 依赖已添加
- ❌ 侧边栏无入口
- ❌ 媒体库未对接（thumbUrl、getAssetUrl 为占位）
- ❌ 场景无持久化
- ❌ 预览区为占位符，无真实视频播放

---

## 二、待补齐项

### 1. 导航入口

在 `apps/frontend/src/components/layout/top.menu.tsx` 的 `firstMenu` 中增加：

```ts
{
  name: t('video_editor', '视频编辑'),
  icon: <VideoIcon />,  // 需添加图标
  path: '/video-editor',
},
```

### 2. 媒体库对接

postiz-app 媒体结构：`{ id, path, thumbnail, name, type }`，API: `GET /media?page=1`

video-editor 需要：

| 桥接层 prop | 来源 | 说明 |
|-------------|------|------|
| `thumbUrlByAssetId` | `media.path` 或 `media.thumbnail` | 缩略图，可用 `mediaDirectory.set(path)` 转 URL |
| `getAssetUrl` | `media.path` | 播放 URL，`(id) => mediaMap[id]?.path` 或经 `mediaDirectory.set` |
| `waveformUrlByAssetId` | 可选 | 音频波形图 URL |

**实现思路**：用 `useSWR('/media?page=1')` 拉取媒体，构建 `Record<id, path>` 传给 bridge。

### 3. 场景持久化

postiz-app 当前无「视频项目/场景」表，可选：

- **方案 A**：新建 `VideoProject` / `VideoScene` 表 + API（推荐长期）
- **方案 B**：先用 `localStorage` 做 demo
- **方案 C**：复用 `Media` 或扩展 `Post` 存 JSON 场景

### 4. 真实预览

传入 `renderPreview`，用 `<video>` 或现有 `VideoFrame` 组件：

```tsx
import { VideoFrame } from '@gitroom/react/helpers/video.frame';

<PostizVideoEditorBridge
  getAssetUrl={(id) => mediaMap[id]?.path}
  renderPreview={({ playheadTime, onPlayRequest, onPauseRequest, getAssetUrl }) => {
    const src = getAssetUrl?.(currentClipMediaId); // 需从 scene 取当前播放的 clip 的 mediaId
    return (
      <VideoFrame
        url={src}
        currentTime={playheadTime}
        onPlay={onPlayRequest}
        onPause={onPauseRequest}
      />
    );
  }}
/>
```

**注意**：`renderPreview` 只有 `playheadTime`，没有「当前 clip 的 mediaId」。要正确预览需：
- 桥接层扩展：传入 `currentClipIds` 或 `clipsAtPlayhead`
- 或宿主根据 `scene` + `playheadTime` 自己计算当前应播放的媒体

### 5. mediaDirectory URL 转换

postiz-app 用 `useMediaDirectory().set(path)` 把存储 path 转成可访问 URL。video-editor 需在 `getAssetUrl` / `thumbUrlByAssetId` 里调用相同逻辑。

### 6. 布局与样式

video-editor 在 `(app)/(site)` 下，已有 layout。建议：
- 使用与 Media 页一致的 `bg-newBgColorInner` 等样式
- 考虑全屏或固定高度，避免时间线被压缩

---

## 三、优先级建议

| 优先级 | 项 | 工作量 |
|--------|-----|--------|
| P0 | 导航入口 | 小 |
| P0 | 媒体库对接（thumb + getAssetUrl） | 中 |
| P1 | 真实预览（renderPreview + 当前 clip） | 中 |
| P2 | 场景持久化 | 大 |
| P3 | waveform 支持 | 小 |

---

## 四、桥接层可扩展点

若 `renderPreview` 无法拿到「当前播放的 clip」，可考虑在 `PostizPreviewContext` 增加：

```ts
currentClips?: Array<{ mediaId: string; trackId: string; offset: number; duration: number }>;
```

宿主据此决定预览区应播放哪个媒体。
