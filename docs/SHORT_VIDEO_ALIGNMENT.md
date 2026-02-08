# short_video 与 postiz 对齐清单

> 基于 short_video 的 CONFIG_LAYER_DESIGN.md、FRONTEND_FLOW_FIELD_ANALYSIS.md 及 API 整理

## 一、配置分层原则

**合并优先级**：系统默认 < 平台账号配置 < 人设配置 < 任务配置

---

## 二、平台账号配置（Platform Account config）

**存储**：`PlatformAccount.config`  
**用途**：账号固定风格、平台特性、默认行为，作为任务配置的默认值

### 2.1 基本信息

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 账号名称 |
| platform | string | 平台：douyin/tiktok/youtube/youtube_shorts/bilibili/instagram_reels |
| account_id | string | 平台上的账号 ID |
| account_url | string | 账号主页 URL |
| persona_id | UUID | 关联的人设 |
| status | string | active/inactive |
| description | string | 描述 |

### 2.2 平台基础（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| platform | string | 平台类型 |
| use_free_videos | boolean | 视频模式 vs 图片模式 |
| compose_provider | string | creatomate / remotion / manim |
| audio_provider | string | edgetts / elevenlabs |
| edgetts_voice_id | string | EdgeTTS 音色 |
| elevenlabs_voice_id | string | ElevenLabs 音色 |

### 2.3 视频格式（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| youtube_mode | string | shorts / standard |
| video_width | number | 宽度 |
| video_height | number | 高度 |
| fps | number | 帧率 |
| quality | string | low / medium / high |

### 2.4 音频（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| edgetts_speed | number | 语速 |
| edgetts_pitch | number | 音调 |
| edgetts_volume | number | 音量 |
| edgetts_style | string | 语音风格 |
| elevenlabs_model_id | string | 模型 |
| elevenlabs_stability | number | 稳定性 |
| elevenlabs_similarity_boost | number | 相似度 |

### 2.5 字幕样式（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| subtitle_font_size | number | 字体大小 |
| subtitle_font_name | string | 字体名 |
| subtitle_font_color | string | 颜色（ASS） |
| subtitle_position | string | top / center / bottom |
| subtitle_outline_* | - | 描边、阴影等 |
| script_languages | string[] | 脚本语言 |
| subtitle_languages | string[] | 字幕语言 |
| subtitle_languages_to_show | string[] | 显示的字幕语言 |

### 2.6 人设与提示词（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| persona_description | string | 覆盖人设默认描述 |
| script_style | string | 脚本风格 |
| prompt_templates | object | 账号专属提示词 |
| prompt_configs | object | { name: { version, variant? } }，9 类：video_captions, image_prompts, voice_script, video_prompts, book_script, search_terms, key_points, subtitle_keywords, manim_style_generation |

### 2.7 内容源（config 内，book_video 用）

| 参数 | 类型 | 说明 |
|------|------|------|
| content_sources | string[] | google_books, wikipedia, open_library, guardian, nyt_books |
| wikipedia_language | string | zh / en / ja |
| content_priority | string[] | 内容源优先级顺序 |

### 2.8 视频合成（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| creatomate_template_id | string | Creatomate 模板 |
| creatomate_* | - | 图片/音频/字幕元素等 |
| remotion_template_id | string | Remotion 模板 |
| video_preset | string | FFmpeg 预设（fast/medium/slow） |
| video_threads | number | 编码线程数 |
| video_crf | number | 质量因子 |

### 2.9 RSS（config 内，book_video 用）

| 参数 | 类型 | 说明 |
|------|------|------|
| enable_rss_sources | boolean | 是否启用 RSS |
| rss_sources | string[] | RSS 源列表 |
| rss_fetch_interval_minutes | number | 抓取间隔 |
| rsshub_base_url | string | RSSHub 基础地址 |

### 2.10 高级（config 内）

| 参数 | 类型 | 说明 |
|------|------|------|
| llm_model_script | string | 脚本模型 |
| llm_model_script_provider | string | 厂商 |
| llm_model_search_terms | string | 搜索关键词模型 |
| llm_model_search_terms_provider | string | |
| llm_model_key_points | string | 关键点模型 |
| llm_model_key_points_provider | string | |
| llm_model_keywords | string | 关键词模型 |
| llm_model_keywords_provider | string | |
| image_platforms | string[] | pexels, pixabay, unsplash |
| video_platforms | string[] | pexels, pixabay |
| platform_weights | object | 平台权重 |

### 2.11 平台账号 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/platform-accounts | 创建账号 |
| GET | /api/v1/platform-accounts | 列表（支持 platform、status、limit） |
| GET | /api/v1/platform-accounts/{id} | 详情 |
| PUT | /api/v1/platform-accounts/{id} | 更新 |
| DELETE | /api/v1/platform-accounts/{id} | 删除 |

---

## 三、任务配置（Task config）

**用途**：每次创建任务时的覆盖项，优先级最高

### 3.1 任务顶层字段（非 config）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| idea | string | ✅（book_video 可空） | 创意内容 |
| environment_prompt | string | ❌ | 环境描述 |
| persona_id | UUID | ❌ | 人设（可覆盖账号默认） |
| platform_account_id | UUID | ❌ | 平台账号（选则继承其 config） |
| workflow_type | string | ✅ | short_video / anime / book_video |
| target_platform | string | ❌ | 目标平台 |
| content_type | string | ❌ | 内容类型 |
| topic_mode | string | ❌ | book_video：auto_topic / manual_topic |
| topic_text | string | ❌ | book_video 手动选题主题 |
| content_source | object | ❌ | book_video：{ material_type, provider, selector } |

### 3.2 任务 config（本次覆盖）

| 参数 | 类型 | 说明 |
|------|------|------|
| idea | string | 创意内容（顶层也可） |
| book_title | string | 指定书籍标题（book_video） |
| book_author | string | 指定书籍作者 |
| book_category | string | 书籍分类过滤 |
| video_duration | number | 目标时长 |
| tone / default_tone | string | 语气 |
| extra_hint / extra_prompt | string | 附加提示 |
| video_aspect_ratio | string | 比例 |
| default_content_style | string | 内容形态 |
| override_script_style_preset | string | 脚本风格 |
| override_prompt_template | string | 提示词覆盖 |
| image_count | number | 图片数量 |
| images_per_platform | number | 每平台图片数 |
| videos_per_platform | number | 每平台视频数 |
| min_image_score | number | 最小图片评分 |
| min_video_score | number | 最小视频评分 |
| default_audience | string | 受众 |
| default_subtitle_preset | string | 字幕预设 |
| use_free_videos | boolean | book_video 素材模式 |
| use_manim_animations | boolean | Manim 动画 |
| generate_ssml | boolean | 是否生成 SSML |

### 3.3 任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/tasks | 创建任务 |
| GET | /api/v1/tasks | 列表（status, workflow_type, integration_id, page, limit） |
| GET | /api/v1/tasks/{id} | 详情 |
| DELETE | /api/v1/tasks/{id} | 删除 |
| POST | /api/v1/tasks/{id}/trigger | 触发 |
| POST | /api/v1/tasks/{id}/retry | 重试 |

### 3.4 任务列表响应字段

```json
{
  "tasks": [
    {
      "id": "uuid",
      "idea": "...",
      "status": "pending|processing|completed|failed",
      "workflow_type": "short_video",
      "persona_id": "uuid",
      "video_url": "https://...",
      "integration_id": "postiz_integration_id",
      "created_at": "...",
      ...
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "pages": 5
}
```

---

## 四、人设（Personas）

### 4.1 人设字段

| 参数 | 类型 | 说明 |
|------|------|------|
| id | UUID | |
| name | string | 人设名称 |
| description | string | 人设描述（→ config.persona_description） |
| persona_type | string | influencer / expert / storyteller / custom |
| avatar_url | string | 头像 |
| status | string | active / inactive |
| tags | string[] | 标签 |
| config | object | 人设配置（参与合并） |

### 4.2 人设 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/personas | 创建 |
| GET | /api/v1/personas | 列表（status, page, limit） |
| GET | /api/v1/personas/{id} | 详情 |
| PUT | /api/v1/personas/{id} | 更新 |
| DELETE | /api/v1/personas/{id} | 删除 |

---

## 五、提示词（Prompts）

### 5.1 提示词类型（9 类）

| name | 说明 |
|------|------|
| video_captions | 视频标题生成 |
| image_prompts | 图片提示词生成 |
| voice_script | 语音脚本生成 |
| video_prompts | 视频动作提示词生成 |
| book_script | 书籍脚本生成 |
| search_terms | 搜索关键词提取 |
| key_points | 关键点识别 |
| subtitle_keywords | 字幕关键词提取 |
| manim_style_generation | Manim 动画样式生成 |

### 5.2 提示词 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/prompts/items | 列表（name, is_active, include_defaults） |
| GET | /api/v1/prompts/grouped/by-name | 按名称分组（用于平台配置选择版本） |
| GET | /api/v1/prompts/name/{name} | 单条 |
| GET | /api/v1/prompts/default/{name} | 默认模板 |
| POST | /api/v1/prompts | 创建 |
| PUT | /api/v1/prompts/name/{name} | 更新 |
| DELETE | /api/v1/prompts/name/{name} | 删除 |

---

## 六、postiz 对应关系

| short_video | postiz |
|-------------|--------|
| PlatformAccount | 无对应实体，用 integration-config 存「平台配置」 |
| Persona | 代理 /api/short-video/personas，列表选择 |
| Prompts | 代理 /api/short-video/prompts/items、prompts/grouped/by-name |
| 平台 config | short-video.integration.settings → POST /api/short-video/integration-config |
| 任务创建 | short-video.tasks.panel → POST /api/short-video/tasks |
| 任务列表 | 代理 GET /api/short-video/tasks?integration_id=xxx |

### 设计原则

- **平台配置**：全在 integration-config，由平台设置页编辑
- **任务创建**：只传任务级字段 + 本次覆盖项；平台配置由**后端**从 integration-config 读取并合并进 config
- **合并优先级**：integration-config（平台默认）< overrides（任务级覆盖）
- **任务面板**：不塞平台级字段到 overrides

---

## 七、补充遗漏项（对照 CONFIG_LAYER_DESIGN 复核）

### 7.1 平台 config 遗漏

| 参数 | 类型 | 说明 |
|------|------|------|
| edgetts_styledegree | number | EdgeTTS 风格强度（0-1） |
| script_source_language | string | 脚本源语言 |
| subtitle_source_language | string | 字幕源语言 |
| creatomate_image_element_prefix | string | 图片元素前缀 |
| creatomate_audio_element_name | string | 音频元素名 |
| creatomate_subtitle_element_name | string | 字幕元素名 |
| audio_bitrate | string | 音频比特率（如 "192k"） |
| audio_sample_rate | number | 音频采样率（Hz） |
| enable_search_expansion | boolean | 搜索词扩展 |
| use_multi_strategy_search | boolean | 多策略搜索 |
| filter_animated_videos | boolean | 过滤动画风格视频 |
| google_books_enabled / wikipedia_enabled / open_library_enabled | boolean | 内容源开关（与 content_sources 二选一表示） |

### 7.2 任务 config 遗漏

| 参数 | 类型 | 说明 |
|------|------|------|
| image_duration | number | 每张图片显示时长（秒） |
| video_min_duration / video_max_duration | number | 视频模式下搜索的时长范围 |
| target_speech_speed | number | 目标语速（字/分钟） |
| min_video_duration / max_video_duration | number | 音频时长控制 |
| speed_factor_accept | number | 速度因子接受阈值 |
| subtitle_tolerance | number | 字幕对齐容差（秒） |
| key_points_count | number | 关键节点数量 |
| keywords_per_subtitle | number | 每条字幕关键词数 |
| video_concurrent_workers | number | 并发处理线程数 |
| video_use_filter_complex | boolean | 是否用 filter_complex |
| video_filter_complex_batch_size | number | filter_complex 每批视频数 |
| subtitle_segment_duration | number | 字幕分段时长 |
| subtitle_segment_threshold | number | 启用分段阈值 |
| animate_images | boolean | 图片动效 |
| image_provider | string | free / comfyui |

### 7.3 postiz 已代理但文档未列 API

| postiz 路径 | short_video 对应 | 说明 |
|-------------|------------------|------|
| GET /book-catalog/categories | /api/v1/book-catalog/categories | 书籍大类 |
| GET /book-catalog/source-tags | /api/v1/book-catalog/source-tags | 小类标签 |
| GET /book-catalog/books/for-selection | /api/v1/book-catalog/books/for-selection | 选书列表 |
| POST /topics/discover | /api/v1/topics/discover | 选题发现 |
| GET /tasks/:taskId | /api/v1/tasks/{id} | 任务详情 |

### 7.4 short_video 有、postiz 未代理的 API（可选）

| short_video 路径 | 说明 |
|------------------|------|
| GET /api/v1/tasks/{id}/video | 获取任务视频 |
| DELETE /api/v1/tasks/{id} | 删除任务 |
| POST /api/v1/tasks/{id}/trigger | 触发任务 |
| POST /api/v1/tasks/{id}/retry | 重试任务 |
| GET /api/v1/voice-library | 音色库 |
| GET /api/v1/video-config/aspect-ratios | 视频比例 |
| GET /api/v1/persona-ssml-presets | 人设 SSML 预设 |
| GET /api/v1/personas/{id}/config | 人设配置 |
