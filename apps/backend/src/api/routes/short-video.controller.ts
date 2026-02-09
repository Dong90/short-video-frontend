import { Body, Controller, Delete, Get, HttpException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { ShortVideoSyncService } from '@gitroom/backend/services/short-video-sync.service';

const SHORT_VIDEO_CONFIG_KEY = 'short_video_integration_config';
/** 按账号存储时的 key 前缀 */
const SHORT_VIDEO_ACCOUNT_CONFIG_PREFIX = 'short_video_config_';

/** 无自定义提示词时，使用 short_video 默认 version 1 */
const PROMPT_CONFIG_NAMES = [
  'video_captions', 'image_prompts', 'voice_script', 'video_prompts', 'book_script',
  'search_terms', 'key_points', 'subtitle_keywords', 'manim_style_generation',
] as const;

const DEFAULT_PROMPT_CONFIGS: Record<string, { version: number }> = Object.fromEntries(
  PROMPT_CONFIG_NAMES.map((name) => [name, { version: 1 }])
);

// 与 short_video 的 TaskStatus 对应：pending / processing / completed / failed / ...
type ShortVideoTaskStatusRaw = string;

// 前端面板使用的归一化状态
export type ShortVideoTaskStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

// 对应 short_video app/api/v1/tasks.py 中的 TaskResponseSchema
interface ShortVideoCreateResponse {
  task_id: string;
  status: ShortVideoTaskStatusRaw;
  created_at: string;
  persona_id?: string | null;
  next_run_at?: string | null;
  queued?: boolean | null;
  queue_error?: string | null;
}

// 对应 short_video get_task_detail 返回的结构（这里只列出我们关心的字段）
interface ShortVideoTaskDetails {
  id: string;
  status: ShortVideoTaskStatusRaw;
  output_data?: {
    video_url?: string;
    video_path?: string;
    thumbnail_url?: string;
    video_sequence?: any[];
    captions_srt_url?: string;
    [key: string]: any;
  };
  progress?: {
    percentage?: number;
    current_step?: string | null;
  };
  [key: string]: any;
}

@ApiTags('Short Video')
@Controller('/short-video')
export class ShortVideoController {
  constructor(
    private _prisma: PrismaService,
    private _integrationService: IntegrationService,
    private _shortVideoSync: ShortVideoSyncService
  ) {}

  private getBaseUrl() {
    const url = process.env.SHORT_VIDEO_API_URL;
    if (!url) {
      throw new HttpException(
        {
          message:
            'SHORT_VIDEO_API_URL is not configured. Please set it in the environment variables.',
        },
        500
      );
    }
    return url.replace(/\/+$/, '');
  }

  /**
   * 构建任务 config：合并 integration-config（平台默认）与 overrides（任务级覆盖）
   * 与 short_video TaskCreateSchema.config 对齐
   */
  private buildTaskConfig(
    integrationId: string,
    platform: string,
    base: Record<string, unknown>,
    ov: Record<string, unknown>
  ): Record<string, unknown> {
    const isDef = (v: unknown) => v !== undefined && v !== null && v !== '';
    const cfg: Record<string, unknown> = {
      integration_id: integrationId,
      platform,
      ...(base.video_duration != null || base.default_video_duration != null
        ? { video_duration: base.video_duration ?? base.default_video_duration }
        : {}),
      ...(base.tone ? { tone: base.tone, default_tone: base.tone } : {}),
      ...(base.default_tone ? { tone: base.default_tone, default_tone: base.default_tone } : {}),
      ...(base.video_aspect_ratio ? { video_aspect_ratio: base.video_aspect_ratio } : {}),
      ...(base.default_video_aspect_ratio ? { video_aspect_ratio: base.default_video_aspect_ratio } : {}),
      ...(base.default_content_style ? { default_content_style: base.default_content_style } : {}),
      ...(base.default_script_style_preset ? { override_script_style_preset: base.default_script_style_preset } : {}),
      ...(base.default_subtitle_preset ? { default_subtitle_preset: base.default_subtitle_preset } : {}),
      ...(base.image_count != null ? { image_count: base.image_count } : {}),
      ...(base.default_audience ? { default_audience: base.default_audience } : {}),
      ...(base.audio_provider ? { audio_provider: base.audio_provider } : {}),
      ...(base.edgetts_voice_id ? { edgetts_voice_id: base.edgetts_voice_id } : {}),
      ...(base.elevenlabs_voice_id ? { elevenlabs_voice_id: base.elevenlabs_voice_id } : {}),
      ...(base.prompt_configs && typeof base.prompt_configs === 'object' && Object.keys(base.prompt_configs).length > 0 ? { prompt_configs: base.prompt_configs } : {}),
      ...(base.default_advanced_prompt ? { override_prompt_template: base.default_advanced_prompt } : {}),
      ...(base.prompt_templates && typeof base.prompt_templates === 'object' && Object.keys(base.prompt_templates).length > 0 ? { prompt_templates: base.prompt_templates } : {}),
      ...(base.enable_rss_sources === true ? { enable_rss_sources: true } : {}),
      ...(Array.isArray(base.rss_sources) ? { rss_sources: base.rss_sources } : {}),
      ...(base.rss_fetch_interval_minutes != null ? { rss_fetch_interval_minutes: base.rss_fetch_interval_minutes } : {}),
      ...(Array.isArray(base.content_sources) ? { content_sources: base.content_sources } : {}),
      ...(base.wikipedia_language ? { wikipedia_language: base.wikipedia_language } : {}),
      ...(Array.isArray(base.content_priority) ? { content_priority: base.content_priority } : {}),
      ...(base.use_free_videos !== undefined ? { use_free_videos: base.use_free_videos } : {}),
      ...(base.rsshub_base_url ? { rsshub_base_url: base.rsshub_base_url } : {}),
      ...(base.compose_provider ? { compose_provider: base.compose_provider } : {}),
      ...(base.llm_model_script ? { llm_model_script: base.llm_model_script } : {}),
      ...(base.llm_model_script_provider ? { llm_model_script_provider: base.llm_model_script_provider } : {}),
      ...(base.llm_model_search_terms ? { llm_model_search_terms: base.llm_model_search_terms } : {}),
      ...(base.llm_model_search_terms_provider ? { llm_model_search_terms_provider: base.llm_model_search_terms_provider } : {}),
      ...(base.llm_model_key_points ? { llm_model_key_points: base.llm_model_key_points } : {}),
      ...(base.llm_model_key_points_provider ? { llm_model_key_points_provider: base.llm_model_key_points_provider } : {}),
      ...(base.llm_model_keywords ? { llm_model_keywords: base.llm_model_keywords } : {}),
      ...(base.llm_model_keywords_provider ? { llm_model_keywords_provider: base.llm_model_keywords_provider } : {}),
      ...(Array.isArray(base.image_platforms) ? { image_platforms: base.image_platforms } : {}),
      ...(Array.isArray(base.video_platforms) ? { video_platforms: base.video_platforms } : {}),
      ...(base.edgetts_speed != null ? { edgetts_speed: base.edgetts_speed } : {}),
      ...(base.edgetts_pitch != null ? { edgetts_pitch: base.edgetts_pitch } : {}),
      ...(base.edgetts_volume != null ? { edgetts_volume: base.edgetts_volume } : {}),
      ...(base.edgetts_style ? { edgetts_style: base.edgetts_style } : {}),
      ...(base.edgetts_styledegree != null ? { edgetts_styledegree: base.edgetts_styledegree } : {}),
      ...(base.elevenlabs_model_id ? { elevenlabs_model_id: base.elevenlabs_model_id } : {}),
      ...(base.elevenlabs_stability != null ? { elevenlabs_stability: base.elevenlabs_stability } : {}),
      ...(base.elevenlabs_similarity_boost != null ? { elevenlabs_similarity_boost: base.elevenlabs_similarity_boost } : {}),
      ...(base.subtitle_font_size != null ? { subtitle_font_size: base.subtitle_font_size } : {}),
      ...(base.subtitle_font_name ? { subtitle_font_name: base.subtitle_font_name } : {}),
      ...(base.subtitle_font_color ? { subtitle_font_color: base.subtitle_font_color } : {}),
      ...(base.subtitle_position ? { subtitle_position: base.subtitle_position } : {}),
      ...(base.subtitle_outline_color ? { subtitle_outline_color: base.subtitle_outline_color } : {}),
      ...(base.subtitle_outline_width != null ? { subtitle_outline_width: base.subtitle_outline_width } : {}),
      ...(base.subtitle_shadow_color ? { subtitle_shadow_color: base.subtitle_shadow_color } : {}),
      ...(base.subtitle_no_background !== undefined ? { subtitle_no_background: base.subtitle_no_background } : {}),
      ...(base.subtitle_back_color ? { subtitle_back_color: base.subtitle_back_color } : {}),
      ...(base.subtitle_border_style != null ? { subtitle_border_style: base.subtitle_border_style } : {}),
      ...(Array.isArray(base.script_languages) ? { script_languages: base.script_languages } : {}),
      ...(base.script_source_language ? { script_source_language: base.script_source_language } : {}),
      ...(Array.isArray(base.subtitle_languages) ? { subtitle_languages: base.subtitle_languages } : {}),
      ...(base.subtitle_source_language ? { subtitle_source_language: base.subtitle_source_language } : {}),
      ...(Array.isArray(base.subtitle_languages_to_show) ? { subtitle_languages_to_show: base.subtitle_languages_to_show } : {}),
      ...(base.youtube_mode ? { youtube_mode: base.youtube_mode } : {}),
      ...(base.video_width != null ? { video_width: base.video_width } : {}),
      ...(base.video_height != null ? { video_height: base.video_height } : {}),
      ...(base.fps != null ? { fps: base.fps } : {}),
      ...(base.quality ? { quality: base.quality } : {}),
      ...(base.creatomate_template_id ? { creatomate_template_id: base.creatomate_template_id } : {}),
      ...(base.remotion_template ? { remotion_template: base.remotion_template } : {}),
      ...(base.remotion_template_id ? { remotion_template: base.remotion_template_id } : {}),
      ...(base.remotion_codec ? { remotion_codec: base.remotion_codec } : {}),
      ...(base.remotion_quality != null ? { remotion_quality: base.remotion_quality } : {}),
      ...(base.fps != null ? { fps: base.fps } : {}),
      ...(base.video_width != null ? { video_width: base.video_width } : {}),
      ...(base.video_height != null ? { video_height: base.video_height } : {}),
      ...(base.remotion_animations && typeof base.remotion_animations === 'object' ? { remotion_animations: base.remotion_animations } : {}),
      ...(base.manim_output_dir ? { manim_output_dir: base.manim_output_dir } : {}),
      ...(base.manim_env_path ? { manim_env_path: base.manim_env_path } : {}),
      ...(base.use_manim_animations !== undefined ? { use_manim_animations: base.use_manim_animations } : {}),
      ...(base.video_preset ? { video_preset: base.video_preset } : {}),
      ...(base.video_threads != null ? { video_threads: base.video_threads } : {}),
      ...(base.video_crf != null ? { video_crf: base.video_crf } : {}),
      ...(base.platform_weights ? { platform_weights: base.platform_weights } : {}),
      ...(base.script_source_language ? { script_source_language: base.script_source_language } : {}),
      ...(base.subtitle_source_language ? { subtitle_source_language: base.subtitle_source_language } : {}),
      ...(base.creatomate_image_element_prefix ? { creatomate_image_element_prefix: base.creatomate_image_element_prefix } : {}),
      ...(base.creatomate_audio_element_name ? { creatomate_audio_element_name: base.creatomate_audio_element_name } : {}),
      ...(base.creatomate_subtitle_element_name ? { creatomate_subtitle_element_name: base.creatomate_subtitle_element_name } : {}),
      ...(base.audio_bitrate ? { audio_bitrate: base.audio_bitrate } : {}),
      ...(base.audio_sample_rate != null ? { audio_sample_rate: base.audio_sample_rate } : {}),
      ...(base.enable_search_expansion !== undefined ? { enable_search_expansion: base.enable_search_expansion } : {}),
      ...(base.use_multi_strategy_search !== undefined ? { use_multi_strategy_search: base.use_multi_strategy_search } : {}),
      ...(base.filter_animated_videos !== undefined ? { filter_animated_videos: base.filter_animated_videos } : {}),
      // 素材搜索高级配置
      ...(base.cascade_core_keyword_first !== undefined ? { cascade_core_keyword_first: base.cascade_core_keyword_first } : {}),
      ...(base.min_image_score != null ? { min_image_score: base.min_image_score } : {}),
      ...(base.min_video_score != null ? { min_video_score: base.min_video_score } : {}),
      ...(base.images_per_platform != null ? { images_per_platform: base.images_per_platform } : {}),
      ...(base.videos_per_platform != null ? { videos_per_platform: base.videos_per_platform } : {}),
      ...(base.cascade_min_images_per_subtitle != null ? { cascade_min_images_per_subtitle: base.cascade_min_images_per_subtitle } : {}),
      ...(base.keyword_search_max_per_subtitle != null ? { keyword_search_max_per_subtitle: base.keyword_search_max_per_subtitle } : {}),
      ...(base.first_keyword_multiplier != null ? { first_keyword_multiplier: base.first_keyword_multiplier } : {}),
      ...(base.allocation_core_keyword_bonus != null ? { allocation_core_keyword_bonus: base.allocation_core_keyword_bonus } : {}),
      ...(base.keyword_min_per_subtitle != null ? { keyword_min_per_subtitle: base.keyword_min_per_subtitle } : {}),
      ...(base.keyword_max_per_subtitle != null ? { keyword_max_per_subtitle: base.keyword_max_per_subtitle } : {}),
      ...(base.filter_core_keyword_bonus_ratio != null ? { filter_core_keyword_bonus_ratio: base.filter_core_keyword_bonus_ratio } : {}),
      ...(base.filter_relevance_weight != null ? { filter_relevance_weight: base.filter_relevance_weight } : {}),
      ...(base.filter_subtitle_relevance_weight != null ? { filter_subtitle_relevance_weight: base.filter_subtitle_relevance_weight } : {}),
      ...(base.filter_base_score_weight != null ? { filter_base_score_weight: base.filter_base_score_weight } : {}),
      // 视频匹配评分权重
      ...(base.use_semantic_matching !== undefined ? { use_semantic_matching: base.use_semantic_matching } : {}),
      ...(base.match_weight_base_score != null ? { match_weight_base_score: base.match_weight_base_score } : {}),
      ...(base.match_weight_keyword != null ? { match_weight_keyword: base.match_weight_keyword } : {}),
      ...(base.match_weight_subtitle_text != null ? { match_weight_subtitle_text: base.match_weight_subtitle_text } : {}),
      ...(base.match_weight_duration != null ? { match_weight_duration: base.match_weight_duration } : {}),
      ...(base.match_weight_semantic != null ? { match_weight_semantic: base.match_weight_semantic } : {}),
      ...(base.match_weight_relevance != null ? { match_weight_relevance: base.match_weight_relevance } : {}),
    };

    // overrides 覆盖 base（任务级优先）
    if (isDef(ov.targetDuration)) cfg.video_duration = Number(ov.targetDuration);
    if (isDef(ov.tone)) {
      cfg.tone = ov.tone;
      cfg.default_tone = ov.tone;
    }
    if (isDef(ov.hint)) {
      cfg.extra_hint = ov.hint;
      cfg.extra_prompt = ov.hint;
    }
    if (isDef(ov.videoAspectRatio)) cfg.video_aspect_ratio = ov.videoAspectRatio;
    if (isDef(ov.contentStyle)) cfg.default_content_style = ov.contentStyle;
    if (isDef(ov.scriptStylePreset)) cfg.override_script_style_preset = ov.scriptStylePreset;
    if (isDef(ov.overridePromptTemplate)) cfg.override_prompt_template = ov.overridePromptTemplate;
    if (ov.promptTemplates && typeof ov.promptTemplates === 'object' && Object.keys(ov.promptTemplates as object).length > 0) cfg.prompt_templates = ov.promptTemplates;
    if (ov.imageCount != null) cfg.image_count = Number(ov.imageCount);
    if (isDef(ov.defaultAudience)) cfg.default_audience = ov.defaultAudience;
    if (isDef(ov.defaultSubtitlePreset)) cfg.default_subtitle_preset = ov.defaultSubtitlePreset;
    if (isDef(ov.audioProvider)) cfg.audio_provider = ov.audioProvider;
    if (isDef(ov.edgettsVoiceId)) cfg.edgetts_voice_id = ov.edgettsVoiceId;
    if (isDef(ov.elevenlabsVoiceId)) cfg.elevenlabs_voice_id = ov.elevenlabsVoiceId;
    if (ov.promptConfigs && typeof ov.promptConfigs === 'object' && Object.keys(ov.promptConfigs).length > 0) {
      cfg.prompt_configs = ov.promptConfigs;
    }
    if (ov.enableRssSources === true) cfg.enable_rss_sources = true;
    if (Array.isArray(ov.rssSources) && ov.rssSources.length > 0) cfg.rss_sources = ov.rssSources;
    if (ov.rssFetchIntervalMinutes != null) cfg.rss_fetch_interval_minutes = Number(ov.rssFetchIntervalMinutes);
    if (Array.isArray(ov.contentSources) && ov.contentSources.length > 0) cfg.content_sources = ov.contentSources;
    if (isDef(ov.wikipediaLanguage)) cfg.wikipedia_language = ov.wikipediaLanguage;
    if (Array.isArray(ov.contentPriority) && ov.contentPriority.length > 0) cfg.content_priority = ov.contentPriority;
    if (ov.useFreeVideos !== undefined) cfg.use_free_videos = !!ov.useFreeVideos;
    if (isDef(ov.rsshubBaseUrl)) cfg.rsshub_base_url = ov.rsshubBaseUrl;
    if (isDef(ov.composeProvider)) cfg.compose_provider = ov.composeProvider;
    if (isDef(ov.llmModelScript)) cfg.llm_model_script = ov.llmModelScript;
    if (isDef(ov.llmModelScriptProvider)) cfg.llm_model_script_provider = ov.llmModelScriptProvider;
    if (isDef(ov.llmModelSearchTerms)) cfg.llm_model_search_terms = ov.llmModelSearchTerms;
    if (isDef(ov.llmModelSearchTermsProvider)) cfg.llm_model_search_terms_provider = ov.llmModelSearchTermsProvider;
    if (isDef(ov.llmModelKeyPoints)) cfg.llm_model_key_points = ov.llmModelKeyPoints;
    if (isDef(ov.llmModelKeyPointsProvider)) cfg.llm_model_key_points_provider = ov.llmModelKeyPointsProvider;
    if (isDef(ov.llmModelKeywords)) cfg.llm_model_keywords = ov.llmModelKeywords;
    if (isDef(ov.llmModelKeywordsProvider)) cfg.llm_model_keywords_provider = ov.llmModelKeywordsProvider;
    if (Array.isArray(ov.imagePlatforms) && ov.imagePlatforms.length > 0) cfg.image_platforms = ov.imagePlatforms;

    // 无自定义 prompt_templates 且无 prompt_configs 时，默认使用 short_video version 1
    if (!cfg.prompt_templates && !cfg.prompt_configs) {
      cfg.prompt_configs = DEFAULT_PROMPT_CONFIGS;
    }

    return cfg;
  }

  /**
   * 将 short_video 的任务状态归一化为前端使用的 4 种状态
   */
  private normalizeStatus(status: ShortVideoTaskStatusRaw): ShortVideoTaskStatus {
    const s = (status || '').toLowerCase();
    if (s === 'processing') {
      return 'processing';
    }
    if (s === 'completed') {
      return 'completed';
    }
    if (s === 'failed' || s === 'cancelled' || s === 'cancelling') {
      return 'failed';
    }
    // pending / scheduled / 其他 都视为排队中
    return 'queued';
  }

  @Post('/tasks')
  async createTasks(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      integrations: Array<{
        integrationId: string;
        platform: string;
      }>;
      overrides?: {
        idea?: string | null;
        targetDuration?: number | null;
        tone?: string | null;
        hint?: string | null;
        personaId?: string | null;
        platformAccountId?: string | null;
        contentType?: string | null;
        videoAspectRatio?: string | null;
        contentStyle?: string | null;
        scriptStylePreset?: string | null;
        overridePromptTemplate?: string | null;
        imageCount?: number | null;
        defaultAudience?: string | null;
        defaultSubtitlePreset?: string | null;
        environmentPrompt?: string | null;
        workflowType?: string | null;
        audioProvider?: string | null;
        edgettsVoiceId?: string | null;
        elevenlabsVoiceId?: string | null;
        /** 提示词版本配置 { name: { version, variant? } }，与 short_video 平台账号 prompt_configs 格式一致 */
        promptConfigs?: Record<string, { version?: number; variant?: string }> | null;
        /** book_video 工作流：启用 RSS 源 */
        enableRssSources?: boolean | null;
        /** book_video 工作流：RSS 源列表（RSSHub 路由或完整 URL） */
        rssSources?: string[] | null;
        /** book_video 工作流：RSS 抓取间隔（分钟） */
        rssFetchIntervalMinutes?: number | null;
        /** book_video 工作流：内容源列表（google_books、wikipedia 等） */
        contentSources?: string[] | null;
        /** book_video 工作流：Wikipedia 语言代码 */
        wikipediaLanguage?: string | null;
        /** book_video 工作流：内容源优先级顺序 */
        contentPriority?: string[] | null;
        /** book_video 工作流：选题模式 auto_topic | manual_topic */
        topicMode?: string | null;
        /** book_video 工作流：选题主题文案（manual_topic 时） */
        topicText?: string | null;
        /** book_video 工作流：内容来源 { material_type, provider, selector } */
        contentSource?: Record<string, unknown> | null;
        /** book_video：素材类型 true=视频模式 false=图片模式 */
        useFreeVideos?: boolean | null;
        /** RSSHub 基础地址 */
        rsshubBaseUrl?: string | null;
        /** 视频合成提供商 creatomate|remotion|manim */
        composeProvider?: string | null;
        /** LLM 模型配置 */
        llmModelScript?: string | null;
        llmModelScriptProvider?: string | null;
        llmModelSearchTerms?: string | null;
        llmModelSearchTermsProvider?: string | null;
        llmModelKeyPoints?: string | null;
        llmModelKeyPointsProvider?: string | null;
        llmModelKeywords?: string | null;
        llmModelKeywordsProvider?: string | null;
        /** 素材平台 pexels|pixabay|unsplash */
        imagePlatforms?: string[] | null;
        /** 任务级配置覆盖，优先级最高 */
        config?: Record<string, unknown> | null;
      };
    }
  ) {
    if (!body?.integrations?.length) {
      throw new HttpException(
        { message: 'No integrations provided' },
        400
      );
    }

    const baseUrl = this.getBaseUrl();

    // 从 integration-config 读取平台配置，与 overrides 合并（对齐 short_video 配置分层）
    let integrationConfig: Record<string, unknown> = {};
    try {
      const row = await this._prisma.sets.findFirst({
        where: { organizationId: org.id, name: SHORT_VIDEO_CONFIG_KEY },
      });
      if (row?.content) {
        integrationConfig = (JSON.parse(row.content) as Record<string, unknown>) || {};
      }
    } catch {
      // 忽略解析错误，使用空配置
    }

    try {
      const results = await Promise.all(
        body.integrations.map(async (integration) => {
          const ov = body.overrides || {};
          const baseConfig = integrationConfig as Record<string, unknown>;
          
          // 配置层级说明：
          // 1. 如果提供了 platform_account_id，short-video 后端会自动加载该账号的配置作为 account_config
          //    此时 integration-config 已经同步到 platform_account，不需要再作为 task_config 传递
          // 2. 如果没有提供 platform_account_id，integration-config 可以作为默认配置使用
          // 3. 只有任务级覆盖（overrides.config）才应该作为 task_config（优先级最高）
          
          const hasPlatformAccount = !!ov.platformAccountId;
          const taskConfigFromOverrides = (ov.config && typeof ov.config === 'object') ? (ov.config as Record<string, unknown>) : {};
          
          let finalTaskConfig: Record<string, unknown> | null = null;
          
          if (hasPlatformAccount) {
            // 有账号：short-video 后端会加载账号配置，这里只传递任务级覆盖作为 task_config
            if (Object.keys(taskConfigFromOverrides).length > 0) {
              finalTaskConfig = this.buildTaskConfig(
                integration.integrationId,
                integration.platform,
                {}, // 不传递 integration-config，让 short-video 使用账号配置
                taskConfigFromOverrides
              );
            }
            // 如果没有任务级覆盖，不传递 config，让 short-video 完全使用账号配置
          } else {
            // 无账号：integration-config 作为默认配置，与任务级配置合并后作为 task_config
            const mergedBase = { ...baseConfig, ...taskConfigFromOverrides };
            finalTaskConfig = this.buildTaskConfig(
              integration.integrationId,
              integration.platform,
              mergedBase,
              {}
            );
          }
          
          // 从 ov 中移除 config，避免重复处理
          const ovWithoutConfig = { ...ov };
          delete ovWithoutConfig.config;

          // 统一创意文案：
          // - 优先使用显式传入的 idea
          // - 其次使用选题文案 topicText（包括 auto_topic 在后端生成后回写的场景）
          // - 再次使用 hint
          // - 对于 book_video 工作流允许留空，让 short_video 按本地书库自动生成
          // - 仅在非 book_video 且前面都为空时使用英文兜底文案
          const workflowType = ov.workflowType ?? baseConfig.workflow_type ?? 'short_video';
          let ideaText =
            ov.idea ||
            ov.topicText ||
            ov.hint ||
            '';
          if (!ideaText && workflowType !== 'book_video') {
            ideaText = 'Short video generated from Postiz';
          }

          const payload = {
            idea: Array.isArray(ideaText) ? (ideaText as string[])[0] : String(ideaText ?? '').trim(),
            environment_prompt: ov.environmentPrompt ?? baseConfig.environment_prompt ?? null,
            persona_id: ov.personaId ?? baseConfig.persona_id ?? null,
            topic_mode: ov.topicMode ?? baseConfig.topic_mode ?? null,
            topic_text: ov.topicText ?? baseConfig.topic_text ?? null,
            content_source: (ov.contentSource ?? baseConfig.content_source) as Record<string, unknown> | null,
            target_platform: integration.platform || null,
            content_type: ov.contentType ?? baseConfig.content_type ?? 'knowledge',
            platform_account_id: ov.platformAccountId ?? null,
            workflow_type: ov.workflowType ?? baseConfig.workflow_type ?? 'short_video',
            config: finalTaskConfig || undefined, // 如果为 null，不传递 config，让 short-video 使用账号配置
            // 目前所有任务都立即执行
            schedule_type: 'immediate',
            scheduled_at: null as string | null,
            daily_time: null as number | null,
            daily_times: null as number[] | null,
            multiple_times: null as unknown,
            weekly_schedule: null as unknown,
            schedule_end_date: null as string | null,
          };

          const res = await axios.post<ShortVideoCreateResponse>(
            `${baseUrl}/api/v1/tasks`,
            payload,
            { timeout: 15000 }
          );

          const data = res.data;

          return {
            id: data.task_id,
            integrationId: integration.integrationId,
            platform: integration.platform,
            status: this.normalizeStatus(data.status),
          };
        })
      );

      return {
        tasks: results,
      };
    } catch (e: any) {
      // 尽量把 short_video 的错误信息透传出来，方便排查
      const status = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to create short video tasks';

      throw new HttpException({ message }, status);
    }
  }

  /** 代理：获取任务列表（与 short_video 对齐，支持 integration_id / platform_account_id 过滤） */
  @Get('/tasks')
  async getTasks(
    @Query('status') status?: string,
    @Query('workflow_type') workflowType?: string,
    @Query('integration_id') integrationId?: string,
    @Query('platform_account_id') platformAccountId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (workflowType) params.set('workflow_type', workflowType);
    if (integrationId) params.set('integration_id', integrationId);
    if (platformAccountId) params.set('platform_account_id', platformAccountId);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/tasks${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch tasks';
      throw new HttpException({ message }, statusCode);
    }
  }

  @Get('/tasks/:taskId')
  async getTask(
    @Param('taskId') taskId: string
  ): Promise<{
    id: string;
    status: ShortVideoTaskStatus;
    videoUrl?: string;
    videoSequence?: any[];
    raw: ShortVideoTaskDetails;
  }> {
    if (!taskId) {
      throw new HttpException({ message: 'taskId is required' }, 400);
    }

    const baseUrl = this.getBaseUrl();

    try {
      const res = await axios.get<ShortVideoTaskDetails>(
        `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`,
        { timeout: 15000 }
      );

      const data = res.data;
      const output = data.output_data || {};

      const videoUrl =
        typeof output.video_url === 'string'
          ? output.video_url
          : typeof output.video_path === 'string'
          ? output.video_path
          : undefined;

      return {
        id: data.id,
        status: this.normalizeStatus(data.status),
        videoUrl,
        videoSequence: output.video_sequence,
        raw: data,
      };
    } catch (e: any) {
      const status = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch short video task';

      throw new HttpException({ message }, status);
    }
  }

  /** 代理：删除任务 */
  @Delete('/tasks/:taskId')
  async deleteTask(@Param('taskId') taskId: string) {
    if (!taskId) {
      throw new HttpException({ message: 'taskId is required' }, 400);
    }
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.delete(`${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to delete task';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：触发任务 */
  @Post('/tasks/:taskId/trigger')
  async triggerTask(@Param('taskId') taskId: string) {
    if (!taskId) {
      throw new HttpException({ message: 'taskId is required' }, 400);
    }
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.post(
        `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`,
        {},
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to trigger task';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：重试任务 */
  @Post('/tasks/:taskId/retry')
  async retryTask(@Param('taskId') taskId: string) {
    if (!taskId) {
      throw new HttpException({ message: 'taskId is required' }, 400);
    }
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.post(
        `${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}/retry`,
        {},
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to retry task';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：创建人设 */
  @Post('/personas')
  async createPersona(@GetOrgFromRequest() _org: Organization, @Body() body: Record<string, unknown>) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.post(`${baseUrl}/api/v1/personas`, body ?? {}, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to create persona';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：更新人设 */
  @Put('/personas/:id')
  async updatePersona(
    @GetOrgFromRequest() _org: Organization,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.put(`${baseUrl}/api/v1/personas/${id}`, body ?? {}, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to update persona';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取人设列表（与 short_video 对齐） */
  @Get('/personas')
  async getPersonas(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/personas${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch personas';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取人设详情（与 short_video 对齐） */
  @Get('/personas/:id')
  async getPersona(@Param('id') id: string) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.get(`${baseUrl}/api/v1/personas/${id}`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch persona';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：删除人设（与 short_video 对齐） */
  @Delete('/personas/:id')
  async deletePersona(
    @GetOrgFromRequest() _org: Organization,
    @Param('id') id: string
  ) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.delete(`${baseUrl}/api/v1/personas/${id}`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to delete persona';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取平台账号列表（与 short_video 对齐），并用 Postiz 已连接的 YouTube 等渠道头像补充 avatar_url */
  @Get('/platform-accounts')
  async getPlatformAccounts(
    @GetOrgFromRequest() org: Organization,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('integration_id') integrationId?: string,
    @Query('account_id') accountId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (status) params.set('status', status);
    if (integrationId?.trim()) params.set('integration_id', integrationId.trim());
    if (accountId?.trim()) params.set('account_id', accountId.trim());
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    try {
      // [DEBUG] 无论 short_video 是否返回空，都先打日志确认 API 被调用
      console.log('[getPlatformAccounts] called:', { integrationId, status, platform, itemsCount: 'pending' });
      const res = await axios.get(
        `${baseUrl}/api/v1/platform-accounts${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      const data = res.data;
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      console.log('[getPlatformAccounts] short_video returned:', { itemsCount: items.length, integrationId });
      if (items.length === 0) return data;

      const integrations = await this._integrationService.getIntegrationsList(org.id);
      const byPlatform = new Map<string, typeof integrations>();
      for (const i of integrations) {
        const p = (i.providerIdentifier || '').toLowerCase();
        if (!byPlatform.has(p)) byPlatform.set(p, []);
        byPlatform.get(p)!.push(i);
        // 也按主平台名索引，如 youtube-channel -> youtube
        const base = p.split('-')[0] || p;
        if (base !== p && !byPlatform.has(base)) byPlatform.set(base, []);
        if (base !== p) byPlatform.get(base)!.push(i);
      }

      const integrationById = integrationId ? integrations.find((i) => i.id === integrationId) : null;
      // [DEBUG] 100% 定位头像根因：查看后端 integration 的 picture 及是否补充到 avatar_url
      if (integrationId && integrationById) {
        console.log('[getPlatformAccounts] integration picture:', {
          integrationId,
          name: integrationById.name,
          hasPicture: !!integrationById.picture,
          pictureLength: integrationById.picture?.length,
          picturePreview: integrationById.picture ? integrationById.picture.slice(0, 80) + '...' : null,
        });
      }
      if (integrationId && integrationById && !integrationById.picture) {
        console.warn('[getPlatformAccounts] integration missing picture:', {
          integrationId,
          name: integrationById.name,
          provider: integrationById.providerIdentifier,
        });
      }

      const withAvatar = items.map((acc: Record<string, unknown>) => {
        const cfg = (acc.config || acc) as Record<string, unknown> | undefined;
        const postiz = (cfg?.postiz || acc.postiz) as { integration_id?: string; organization_id?: string } | undefined;
        const linkedIntegrationId = postiz?.integration_id;

        let match: (typeof integrations)[0] | undefined;
        let matchByIds = false;

        if (integrationById && linkedIntegrationId === integrationId) {
          match = integrationById;
          matchByIds = true;
        } else {
          const plat = String(acc.platform || '').toLowerCase();
          const platBase = plat.split('-')[0] || plat.split('_')[0] || plat;
          const list =
            byPlatform.get(plat) ??
            byPlatform.get(platBase) ??
            integrations.filter((i) => {
              const pi = (i.providerIdentifier || '').toLowerCase();
              return pi === plat || pi === platBase || pi.startsWith(plat + '-') || pi.startsWith(platBase + '-') || pi.startsWith(platBase + '_');
            });
          if (list?.length) {
            const candidateIds = [
              acc.internal_id,
              acc.channel_id,
              acc.channelId,
              acc.external_id,
              acc.account_id,
              cfg?.account_id,
              cfg?.channel_id,
              cfg?.channelId,
            ]
              .filter(Boolean)
              .map((v) => String(v).trim())
              .filter((s) => s.length > 0);

            match = list.find((i) => {
              const iid = String(i.internalId || '').trim();
              const rid = String((i as { rootInternalId?: string }).rootInternalId || '').trim();
              const idMatch = candidateIds.some((cid) => cid === iid || cid === rid);
              if (idMatch) matchByIds = true;
              const iname = String(i.name || '').trim();
              const aname = String(acc.name || '').trim();
              const nameMatch = iname && aname && iname === aname;
              return idMatch || nameMatch;
            });
          }
        }

        const isValidAvatarUrl = (u: string | null | undefined): u is string => {
          if (!u || typeof u !== 'string') return false;
          const t = u.trim();
          return t.length > 0 && (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/'));
        };
        const upstreamAvatar =
          (typeof acc.avatar_url === 'string' ? acc.avatar_url : null) ||
          (typeof acc.thumbnail_url === 'string' ? acc.thumbnail_url : null) ||
          (typeof acc.profile_image_url === 'string' ? acc.profile_image_url : null) ||
          (typeof acc.thumbnail === 'string' ? acc.thumbnail : null);
        const trimmedUpstream = upstreamAvatar?.trim();
        const postizAvatarStr = matchByIds && match?.picture?.trim() ? String(match.picture).trim() : null;
        const finalAvatar = (isValidAvatarUrl(postizAvatarStr) ? postizAvatarStr : null) || (isValidAvatarUrl(trimmedUpstream) ? trimmedUpstream : null);

        const enriched: Record<string, unknown> = finalAvatar ? { ...acc, avatar_url: finalAvatar } : acc;
        if (matchByIds && match && integrationById && linkedIntegrationId === integrationId) {
          if (!enriched.name || String(enriched.name).trim() === '') enriched.name = match.name;
          if (isValidAvatarUrl(match.picture)) enriched.avatar_url = match.picture;
        }
        return enriched;
      });

      if (Array.isArray(data?.items)) {
        return { ...data, items: withAvatar };
      }
      return withAvatar;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch platform accounts';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 同步平台账号：将当前集成关联到 short_video 的 platform_account（新建或关联已有） */
  @Post('/sync-platform-account')
  async syncPlatformAccount(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { integration_id: string }
  ) {
    const integrationId = body?.integration_id?.trim();
    if (!integrationId) {
      throw new HttpException({ message: 'integration_id is required' }, 400);
    }

    const integrations = await this._integrationService.getIntegrationsList(org.id);
    const integration = integrations.find((i) => i.id === integrationId);
    if (!integration) {
      throw new HttpException({ message: 'Integration not found' }, 404);
    }

    const provider = integration.providerIdentifier || '';
    // 对于大部分平台，integration.internalId 即平台原生 ID（如 YouTube channel_id）
    const nativeAccountId = (integration as any).internalId || undefined;
    console.log('[sync-platform-account] called:', {
      integrationId,
      provider,
      name: integration.name,
    });
    const result = await this._shortVideoSync.syncPlatformAccountForIntegration({
      integrationId,
      organizationId: org.id,
      name: integration.name || '',
      picture: integration.picture || undefined,
      provider,
      accountId: nativeAccountId,
    });

    if (!result?.id) {
      const reason = this._shortVideoSync.getLastSyncFailureReason();
      const message =
        reason ||
        'Failed to sync platform account. Check SHORT_VIDEO_API_URL and short_video service.';
      console.warn('[sync-platform-account] failed:', { integrationId, provider, reason });
      throw new HttpException({ message }, 500);
    }
    console.log('[sync-platform-account] success:', { integrationId, platform_account_id: result.id });
    return { ok: true, platform_account_id: result.id };
  }

  /** 代理：获取平台账号详情（与 short_video 对齐） */
  @Get('/platform-accounts/:id')
  async getPlatformAccount(@Param('id') id: string) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.get(`${baseUrl}/api/v1/platform-accounts/${id}`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch platform account';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：创建平台账号（与 short_video 对齐） */
  @Post('/platform-accounts')
  async createPlatformAccount(
    @GetOrgFromRequest() _org: Organization,
    @Body() body: Record<string, unknown>
  ) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.post(`${baseUrl}/api/v1/platform-accounts`, body ?? {}, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to create platform account';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：删除平台账号（与 short_video 对齐） */
  @Delete('/platform-accounts/:id')
  async deletePlatformAccount(@Param('id') id: string) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.delete(`${baseUrl}/api/v1/platform-accounts/${id}`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to delete platform account';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：更新平台账号（与 short_video 对齐） */
  @Put('/platform-accounts/:id')
  async updatePlatformAccount(
    @GetOrgFromRequest() _org: Organization,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>
  ) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.put(`${baseUrl}/api/v1/platform-accounts/${id}`, body ?? {}, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to update platform account';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 获取当前组织的短视频平台配置（用于任务创建默认值）
   * @param platform_account_id 按账号获取配置；不传则返回旧版全局配置（兼容） */
  @Get('/integration-config')
  async getIntegrationConfig(
    @GetOrgFromRequest() org: Organization,
    @Query('platform_account_id') platformAccountId?: string
  ) {
    const key =
      platformAccountId?.trim()
        ? `${SHORT_VIDEO_ACCOUNT_CONFIG_PREFIX}${platformAccountId.trim()}`
        : SHORT_VIDEO_CONFIG_KEY;
    const row = await this._prisma.sets.findFirst({
      where: {
        organizationId: org.id,
        name: key,
      },
    });
    if (!row?.content) return {};
    try {
      return JSON.parse(row.content) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** 保存短视频平台配置（按账号）
   * @param platform_account_id 必填，指定要保存到哪个平台账号
   * @param integration_id 可选，Postiz 集成ID，用于关联 platform_account 与集成（集成删除时级联删除）
   * @param name, avatar_url, description, account_url 可选，同步更新 platform_account 基础信息 */
  @Post('/integration-config')
  async saveIntegrationConfig(
    @GetOrgFromRequest() org: Organization,
    @Body() body: Record<string, unknown> & {
      platform_account_id?: string;
      integration_id?: string;
      name?: string;
      avatar_url?: string;
      description?: string;
      account_url?: string;
    }
  ) {
    const platformAccountId = body.platform_account_id && typeof body.platform_account_id === 'string'
      ? body.platform_account_id.trim()
      : undefined;
    const integrationId = body.integration_id && typeof body.integration_id === 'string'
      ? body.integration_id.trim()
      : undefined;

    const accountConfig = { ...body };
    delete accountConfig.platform_account_id;
    delete accountConfig.integration_id;
    delete accountConfig.name;
    delete accountConfig.avatar_url;
    delete accountConfig.description;
    delete accountConfig.account_url;

    const content = JSON.stringify(accountConfig ?? {});
    const key = platformAccountId
      ? `${SHORT_VIDEO_ACCOUNT_CONFIG_PREFIX}${platformAccountId}`
      : SHORT_VIDEO_CONFIG_KEY;

    const row = await this._prisma.sets.findFirst({
      where: {
        organizationId: org.id,
        name: key,
      },
    });
    if (row) {
      await this._prisma.sets.update({
        where: { id: row.id },
        data: { content },
      });
    } else {
      await this._prisma.sets.create({
        data: {
          organizationId: org.id,
          name: key,
          content,
        },
      });
    }

    // 同步到 short-video 的 platform_account（按 platform_account_id），更新全部信息
    if (platformAccountId) {
      const baseUrl = this.getBaseUrl();
      try {
        const configToSync = { ...accountConfig };
        // 存储 postiz 关联到 config，用于 integration_id 过滤与集成删除时级联删除
        if (integrationId && org?.id) {
          configToSync.postiz = {
            organization_id: org.id,
            integration_id: integrationId,
          };
        }
        const putBody: Record<string, unknown> = { config: configToSync };
        // 同步 persona_id 到顶层（short_video 已支持 config.persona_id 同步）
        if (accountConfig.persona_id !== undefined) {
          putBody.persona_id = accountConfig.persona_id;
        }
        // 同步基础信息（保存时更新全部）
        if (body.name !== undefined && typeof body.name === 'string') putBody.name = body.name;
        if (body.avatar_url !== undefined) putBody.avatar_url = body.avatar_url;
        if (body.description !== undefined) putBody.description = body.description;
        if (body.account_url !== undefined) putBody.account_url = body.account_url;
        await axios.put(
          `${baseUrl}/api/v1/platform-accounts/${platformAccountId}`,
          putBody,
          {
            timeout: 15000,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (e: any) {
        console.warn('Failed to sync integration-config to platform_account:', e?.message);
      }
    }

    return { ok: true };
  }

  /** 代理：获取按名称分组的提示词列表（用于 Platform 配置的 Prompt 版本选择） */
  @Get('/prompts/grouped/by-name')
  async getPromptsGroupedByName(
    @Query('is_active') isActive?: string,
    @Query('include_defaults') includeDefaults?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (isActive !== undefined) params.set('is_active', isActive);
    if (includeDefaults !== undefined) params.set('include_defaults', includeDefaults);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/prompts/grouped/by-name${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch prompts grouped by name';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取提示词列表（与 short_video 对齐） */
  @Get('/prompts/items')
  async getPrompts(
    @Query('name') name?: string,
    @Query('is_active') isActive?: string,
    @Query('include_defaults') includeDefaults?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (isActive !== undefined) params.set('is_active', isActive);
    if (includeDefaults !== undefined) params.set('include_defaults', includeDefaults);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/prompts/items${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch prompts';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取书籍大类（book_video 选书用） */
  @Get('/book-catalog/categories')
  async getBookCatalogCategories() {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.get(`${baseUrl}/api/v1/book-catalog/categories`, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch book catalog categories';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取某大类下的小类标签（book_video 选书用） */
  @Get('/book-catalog/source-tags')
  async getBookCatalogSourceTags(@Query('category') category: string) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/book-catalog/source-tags${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch source tags';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：获取用于选书的书籍列表（book_video 选书用） */
  @Get('/book-catalog/books/for-selection')
  async getBooksForSelection(
    @Query('category') category: string,
    @Query('limit') limit?: string,
    @Query('filter_used_books') filterUsedBooks?: string,
    @Query('source_tags') sourceTags?: string,
    @Query('require_main_content') requireMainContent?: string,
    @Query('require_toc') requireToc?: string,
    @Query('require_reviews') requireReviews?: string
  ) {
    const baseUrl = this.getBaseUrl();
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (limit) params.set('limit', limit);
    if (filterUsedBooks !== undefined) params.set('filter_used_books', filterUsedBooks);
    if (sourceTags) params.set('source_tags', sourceTags);
    if (requireMainContent !== undefined) params.set('require_main_content', requireMainContent);
    if (requireToc !== undefined) params.set('require_toc', requireToc);
    if (requireReviews !== undefined) params.set('require_reviews', requireReviews);
    const qs = params.toString();
    try {
      const res = await axios.get(
        `${baseUrl}/api/v1/book-catalog/books/for-selection${qs ? `?${qs}` : ''}`,
        { timeout: 15000 }
      );
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to fetch books for selection';
      throw new HttpException({ message }, statusCode);
    }
  }

  /** 代理：选题发现（book_video 系统推荐主题用） */
  @Post('/topics/discover')
  async discoverTopics(@Body() body: Record<string, unknown>) {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.post(`${baseUrl}/api/v1/topics/discover`, body ?? {}, {
        timeout: 15000,
      });
      return res.data;
    } catch (e: any) {
      const statusCode = e?.response?.status ?? 500;
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        'Failed to discover topics';
      throw new HttpException({ message }, statusCode);
    }
  }
}


