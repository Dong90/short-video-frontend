# 剪辑 / 混剪 / YT-DL 集成方案

本文档说明 opencut-editor + postiz-app 如何支持**剪辑**、**混剪**和 **yt-dlp** 集成。

---

## 一、能力现状与缺口

| 能力 | 现状 | 需补充 |
|------|------|--------|
| **剪辑** | ✅ 已有：split、trim、delete、duplicate、move | 无 |
| **混剪** | ✅ 多轨、多片段；`postizSceneToVideoSequence` 可导出 | 宿主需实现合成（FFmpeg/Remotion） |
| **YT-DL** | ⚠️ `AssetSourceAPI.importFromUrl` 已定义 | 宿主实现 + 适配器工具 |

---

## 二、剪辑（已有）

opencut-editor 已支持：

- **裁剪**：trim（左右拖拽）
- **分割**：split（右键或快捷键）
- **删除**：delete
- **复制**：duplicate
- **移动**：拖拽片段、跨轨

无需额外开发。

---

## 三、混剪（导出 + 合成）

### 3.1 数据流

```
PostizScene → postizSceneToVideoSequence → video_sequence
                                              ↓
                                    FFmpeg / short_video / Remotion 合成
                                              ↓
                                           最终视频
```

### 3.2 已有能力

- `postizSceneToVideoSequence(scene, getAssetUrl)`：将 scene 转为 `{ url, duration, position }[]`
- 多轨、多片段叠加（视频轨 + 音频轨 + 字幕轨）

### 3.3 宿主需实现

| 项 | 说明 |
|----|------|
| **合成服务** | 按 `video_sequence` 调用 FFmpeg、short_video 或 Remotion 生成最终视频 |
| **getAssetUrl** | 将 `mediaId` 解析为可访问的 URL（媒体库 path 或 CDN） |

---

## 四、YT-DL 集成

### 4.1 流程

```
用户输入 URL（YouTube/B站等）
        ↓
assetAPI.importFromUrl(url)  ← 宿主实现：调 yt-dlp 下载，返回 VideoAsset
        ↓
createVideoElementFromAsset(asset, startTime)  ← opencut-editor 提供
        ↓
appendVideoToScene(scene, element)  ← opencut-editor 提供
        ↓
onSceneChange(updatedScene)
```

### 4.2 opencut-editor 已提供

- **AssetSourceAPI.importFromUrl**：接口已定义，宿主实现
- **assetImport 适配器**：`createVideoElementFromAsset`、`appendVideoToScene`、`getSceneEndTime`（见下节）

### 4.3 宿主需实现

**1. assetAPI.importFromUrl**

```ts
// postiz-app 或 short_video 后端
assetAPI: {
  importFromUrl: async (url: string, type: "video" | "image" | "audio") => {
    // 1. 调 yt-dlp 下载（或后端 API）
    //    yt-dlp -f "best[ext=mp4]" -o "/tmp/%(id)s.%(ext)s" <url>
    // 2. 获取 duration（ffprobe 或 yt-dlp --print duration）
    // 3. 上传到媒体库或返回临时 URL
    const filePath = await downloadWithYtDlp(url);
    const duration = await getDuration(filePath);
    const media = await uploadToMediaLibrary(filePath);
    return {
      id: media.id,
      url: media.url,
      type: "video",
      duration,
    };
  },
}
```

**2. 从链接导入 UI**

在 `PostizVideoEditorBridge` 的 `children` 插槽中增加「从链接导入」按钮：

```tsx
<PostizVideoEditorBridge ...>
  <ImportFromUrlButton
    assetAPI={assetAPI}
    onImport={(asset) => {
      const startTime = getSceneEndTime(scene);
      const el = createVideoElementFromAsset(asset, startTime);
      const next = appendVideoToScene(scene, el);
      setScene(next);
    }}
  />
</PostizVideoEditorBridge>
```

---

## 五、推荐实施顺序

1. **Phase 1**：实现 `assetAPI.importFromUrl`（后端调 yt-dlp）
2. **Phase 2**：在 postiz 视频编辑页增加「从链接导入」入口，使用 `createVideoElementFromAsset` + `appendVideoToScene`
3. **Phase 3**：实现导出合成（FFmpeg 或 short_video 按 `postizSceneToVideoSequence` 合成）

---

## 六、关键文件索引

| 项目 | 路径 |
|------|------|
| assetImport 适配器 | `packages/opencut-editor/src/video/adapters/assetImport.ts` |
| shortVideo 适配器 | `packages/opencut-editor/src/video/adapters/shortVideo.ts` |
| postiz 桥接层 | `packages/opencut-editor/src/PostizVideoEditorBridge.tsx` |
| postiz 视频编辑页 | `apps/frontend/src/app/(app)/(site)/video-editor/page.tsx` |
