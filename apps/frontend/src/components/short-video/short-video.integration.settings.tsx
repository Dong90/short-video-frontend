'use client';

import React, { FC, useState, useEffect, useCallback, useImperativeHandle, useRef, forwardRef } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { CollapsibleSection, WeightSlider, ToggleSwitch } from './platform-config-section';

export interface ShortVideoIntegrationSettingsRef {
  getConfig: () => Record<string, unknown>;
  setConfig: (c: Record<string, unknown>) => void;
}

export const ShortVideoIntegrationSettings = forwardRef<ShortVideoIntegrationSettingsRef, {
  integrationId: string;
  integrationIdentifier?: string;
  platformAccountId?: string;
  /** Postiz 集成 ID，用于关联 platform_account（集成删除时级联删除） */
  postizIntegrationId?: string;
  /** 集成信息，保存时同步更新 platform_account 基础信息 */
  integrationInfo?: { name?: string; picture?: string; description?: string };
  onClose: () => void;
  /** 内嵌模式：不显示独立弹窗样式，用于放在父级弹窗内 */
  embedded?: boolean;
}>(function ShortVideoIntegrationSettings({ integrationId, integrationIdentifier: propIntegrationIdentifier, platformAccountId: propAccountId, postizIntegrationId, integrationInfo, onClose, embedded }, ref) {
  const t = useT();
  const fetch = useFetch();
  const [saving, setSaving] = useState(false);
  const [internalAccountId, setInternalAccountId] = useState('');
  const [platformAccounts, setPlatformAccounts] = useState<Array<{ id: string; name: string; platform: string; avatar_url?: string }>>([]);
  const shortVideoTabRef = React.useRef<{ getConfig: () => Record<string, unknown>; setConfig: (c: Record<string, unknown>) => void } | null>(null);
  const [topUseFreeVideos, setTopUseFreeVideos] = useState(true);

  useImperativeHandle(ref, () => ({
    getConfig: () => shortVideoTabRef.current?.getConfig?.() ?? {},
    setConfig: (c) => shortVideoTabRef.current?.setConfig?.(c),
  }), []);

  // short_video 默认使用 youtube 平台
  const integrationIdentifier = propIntegrationIdentifier ?? (integrationId === 'short_video' ? 'youtube' : undefined);
  const effectiveAccountId = propAccountId || internalAccountId;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: 'active', limit: '100' });
    if (postizIntegrationId) params.set('integration_id', postizIntegrationId);
    fetch(`/short-video/platform-accounts?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const items = d?.items ?? d ?? [];
        const pickAvatar = (a: any) => {
          const raw = (a.avatar_url || a.thumbnail_url || a.profile_image_url || a.thumbnail || '')?.trim();
          if (!raw) return undefined;
          if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) return raw;
          return undefined;
        };
        const accs = items.map((a: any) => ({
          id: a.id,
          name: a.name || a.id,
          platform: a.platform || '',
          avatar_url: pickAvatar(a),
        }));
        setPlatformAccounts(accs);
        if (!propAccountId && accs.length > 0) {
          const plat = (integrationIdentifier || '').toLowerCase();
          const match = plat
            ? accs.find((a: { platform: string }) => (a.platform || '').toLowerCase() === plat) || accs[0]
            : accs[0];
          setInternalAccountId(match.id);
        }
      });
    return () => { cancelled = true; };
  }, [propAccountId, integrationIdentifier, postizIntegrationId, fetch]);

  // 非 embedded 时加载配置以同步顶部视频开关初始值
  useEffect(() => {
    if (embedded || !effectiveAccountId) return;
    let cancelled = false;
    fetch(`/short-video/integration-config?platform_account_id=${encodeURIComponent(effectiveAccountId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const v = d?.use_free_videos;
        setTopUseFreeVideos(v === false ? false : true);
      });
    return () => { cancelled = true; };
  }, [embedded, effectiveAccountId, fetch]);

  const handleSave = useCallback(async () => {
    const config = shortVideoTabRef.current?.getConfig?.();
    if (!config) return;
    if (!effectiveAccountId) {
      return;
    }
    setSaving(true);
    try {
      const configWithAccount: Record<string, unknown> = {
        ...config,
        platform_account_id: effectiveAccountId,
      };
      if (postizIntegrationId) {
        configWithAccount.integration_id = postizIntegrationId;
      }
      // 保存时同步更新 platform_account 基础信息
      if (integrationInfo?.name) configWithAccount.name = integrationInfo.name;
      if (integrationInfo?.picture) configWithAccount.avatar_url = integrationInfo.picture;
      if (integrationInfo?.description) configWithAccount.description = integrationInfo.description;
      const res = await fetch('/short-video/integration-config', {
        method: 'POST',
        body: JSON.stringify(configWithAccount),
      });
      if (res.ok) {
        onClose();
        if (embedded) return;
      }
    } finally {
      setSaving(false);
    }
  }, [fetch, onClose, effectiveAccountId, postizIntegrationId, integrationInfo]);

  return (
    <div className={embedded ? 'flex flex-col gap-[16px]' : 'w-[720px] max-w-full bg-newBgColorInner rounded-[16px] flex flex-col text-textColor'}>
      {!embedded && (
        <div className="flex items-center h-[56px] px-[20px] border-b border-newBorder">
          <div className="flex-1 text-[16px] font-[600]">
            {t('short_video_account_settings', '短视频账号配置')}
          </div>
          <button
            type="button"
            className="text-textItemBlur text-[18px]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      )}

      <div className={embedded ? 'flex flex-col gap-[16px]' : 'flex-1 p-[20px] overflow-y-auto flex flex-col gap-[16px]'}>
        {/* 非 embedded 时顶部显示平台 + 视频开关，确保始终可见 */}
        {!embedded && (
          <div className="rounded-[10px] border border-newBorder bg-newSettings/50 p-[18px] flex items-center justify-between gap-[18px] flex-wrap">
            <div className="flex items-center gap-[18px] min-w-0">
              <ImageWithFallback
                fallbackSrc={`/icons/platforms/${(integrationIdentifier || 'youtube').toLowerCase()}.png`}
                src={`/icons/platforms/${(integrationIdentifier || 'youtube').toLowerCase()}.png`}
                className="rounded-[10px] shrink-0"
                alt=""
                width={56}
                height={56}
              />
              <div className="flex flex-col gap-[6px] min-w-0">
                <div className="text-[15px] font-[600]">{t('short_video_platform_config', '短视频平台配置')}</div>
                <div className="text-[12px] text-textItemBlur">
                  {t('platform', '平台')}: {integrationIdentifier || 'youtube'}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-[4px] shrink-0">
              <span className="text-[12px]">{t('video_mode', '视频模式')}</span>
              <ToggleSwitch checked={topUseFreeVideos} onChange={(v) => {
                setTopUseFreeVideos(v);
                const cfg = shortVideoTabRef.current?.getConfig?.() ?? {};
                shortVideoTabRef.current?.setConfig?.({ ...cfg, use_free_videos: v });
              }} />
              <span className="text-[11px] text-textItemBlur">{t('use_video_material', '使用视频素材')}</span>
            </div>
          </div>
        )}
        {!propAccountId && platformAccounts.length > 0 && (
          <label className="flex items-center gap-[8px] text-[12px]">
            <span className="text-textItemBlur shrink-0">{t('platform_account', '平台账号')}</span>
            <select
              className="h-[32px] min-w-[180px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={internalAccountId}
              onChange={(e) => setInternalAccountId(e.target.value)}
            >
              <option value="">{t('short_video_select_account_first', '请先选择平台账号')}</option>
              {platformAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>
              ))}
            </select>
          </label>
        )}
        <ShortVideoTab
          ref={shortVideoTabRef}
          platform={integrationIdentifier}
          platformAccountId={effectiveAccountId || undefined}
          platformAccounts={platformAccounts}
          integrationIdentifier={integrationIdentifier}
          useFreeVideosOverride={!embedded ? topUseFreeVideos : undefined}
          onUseFreeVideosChange={!embedded ? setTopUseFreeVideos : undefined}
          hidePlatformOverview={embedded}
        />
      </div>

      {!embedded && (
        <div className="h-[60px] border-t border-newBorder px-[20px] flex items-center justify-end gap-[8px]">
          <button
            type="button"
            className="text-[13px] text-textItemBlur"
            onClick={onClose}
          >
            {t('cancel', '取消')}
          </button>
          <button
            type="button"
            className="h-[32px] px-[16px] rounded-[8px] bg-[#612BD3] text-[13px] font-[600] text-white disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || !effectiveAccountId}
          >
            {saving ? t('saving', '保存中…') : t('save', '保存')}
          </button>
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          <button
            type="button"
            className="h-[32px] px-[16px] rounded-[8px] bg-[#612BD3] text-[13px] font-[600] text-white disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || !effectiveAccountId}
          >
            {saving ? t('saving', '保存中…') : t('save', '保存')}
          </button>
        </div>
      )}
    </div>
  );
});

// 与 short_video Accounts 对齐：语音引擎、声音（写死，后续从 API 获取）
const AUDIO_PROVIDER_OPTIONS = [
  { value: 'edgetts', label: 'EdgeTTS' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
] as const;
const EDGETTS_VOICES = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '中文女声-晓晓' },
  { value: 'zh-CN-YunxiNeural', label: '中文男声-云希' },
  { value: 'zh-CN-YunyangNeural', label: '中文男声-云扬' },
  { value: 'en-US-AriaNeural', label: '英文女声-Aria' },
  { value: 'en-US-GuyNeural', label: '英文男声-Guy' },
] as const;
const ELEVENLABS_VOICES = [
  { value: 'default', label: '默认' },
  { value: 'alloy', label: 'alloy' },
  { value: 'echo', label: 'echo' },
  { value: 'fable', label: 'fable' },
  { value: 'onyx', label: 'onyx' },
  { value: 'nova', label: 'nova' },
  { value: 'shimmer', label: 'shimmer' },
] as const;
/** 提示词配置类型（与 short_video PROMPT_CONFIG_NAMES 对齐） */
const PROMPT_CONFIG_NAMES = [
  'video_captions',
  'image_prompts',
  'voice_script',
  'video_prompts',
  'book_script',
  'search_terms',
  'key_points',
  'subtitle_keywords',
  'manim_style_generation',
] as const;
const PROMPT_CORE_NAMES = ['voice_script', 'image_prompts', 'video_captions'] as const;
const PROMPT_EXTENDED_NAMES = PROMPT_CONFIG_NAMES.filter((n) => !(PROMPT_CORE_NAMES as readonly string[]).includes(n));

const PROMPT_NAME_LABELS: Record<string, string> = {
  video_captions: '视频标题生成',
  image_prompts: '图片提示词生成',
  voice_script: '语音脚本生成',
  video_prompts: '视频动作提示词生成',
  book_script: '书籍脚本生成',
  search_terms: '搜索关键词提取',
  key_points: '关键点识别',
  subtitle_keywords: '字幕关键词提取',
  manim_style_generation: 'Manim 动画样式生成',
};

interface ShortVideoTabRef {
  getConfig: () => Record<string, unknown>;
  setConfig: (c: Record<string, unknown>) => void;
}

interface PromptOption {
  id: string;
  name: string;
  version: number;
  variant?: string | null;
  is_default?: boolean;
  description?: string;
}

const ShortVideoTab = forwardRef<ShortVideoTabRef, {
  platform?: string;
  platformAccountId?: string;
  platformAccounts?: Array<{ id: string; name: string; platform: string; avatar_url?: string }>;
  integrationIdentifier?: string;
  useFreeVideosOverride?: boolean;
  onUseFreeVideosChange?: (v: boolean) => void;
  /** 内嵌模式下由父级展示平台概览，此处隐藏避免重复 */
  hidePlatformOverview?: boolean;
}>(function ShortVideoTab({ platform, platformAccountId, platformAccounts = [], integrationIdentifier, useFreeVideosOverride, onUseFreeVideosChange, hidePlatformOverview }, ref) {
  const t = useT();
  const fetch = useFetch();
  const [promptsGrouped, setPromptsGrouped] = useState<Record<string, PromptOption[]>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [audioProvider, setAudioProvider] = useState<'edgetts' | 'elevenlabs'>('edgetts');
  const [edgettsVoiceId, setEdgettsVoiceId] = useState('zh-CN-XiaoxiaoNeural');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('default');
  const [useFreeVideos, setUseFreeVideos] = useState(true);
  const effectiveUseFreeVideos = useFreeVideosOverride ?? useFreeVideos;
  const effectiveSetUseFreeVideos = useCallback((v: boolean) => {
    if (onUseFreeVideosChange) onUseFreeVideosChange(v);
    else setUseFreeVideos(v);
  }, [onUseFreeVideosChange]);
  const [composeProvider, setComposeProvider] = useState('creatomate');
  const [llmModelScript, setLlmModelScript] = useState('gpt-4o-mini');
  const [llmModelScriptProvider, setLlmModelScriptProvider] = useState('openai');
  const [llmModelSearchTerms, setLlmModelSearchTerms] = useState('gpt-4o-mini');
  const [llmModelSearchTermsProvider, setLlmModelSearchTermsProvider] = useState('openai');
  const [llmModelKeyPoints, setLlmModelKeyPoints] = useState('gpt-4o-mini');
  const [llmModelKeyPointsProvider, setLlmModelKeyPointsProvider] = useState('openai');
  const [llmModelKeywords, setLlmModelKeywords] = useState('gpt-4o-mini');
  const [llmModelKeywordsProvider, setLlmModelKeywordsProvider] = useState('openai');
  const [imagePlatforms, setImagePlatforms] = useState<string[]>(['pexels', 'pixabay', 'unsplash']);
  const [videoPlatforms, setVideoPlatforms] = useState<string[]>(['pexels', 'pixabay']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVoiceTuning, setShowVoiceTuning] = useState(false);
  const [showSubtitleAdvanced, setShowSubtitleAdvanced] = useState(false);
  const [showExtendedPrompts, setShowExtendedPrompts] = useState(false);
  // 音频、多语言、Creatomate、FFmpeg、素材搜索
  const [edgettsStyledegree, setEdgettsStyledegree] = useState(0.8);
  const [scriptSourceLanguage, setScriptSourceLanguage] = useState('zh');
  const [subtitleSourceLanguage, setSubtitleSourceLanguage] = useState('zh');
  const [creatomateImagePrefix, setCreatomateImagePrefix] = useState('Image');
  const [creatomateAudioElement, setCreatomateAudioElement] = useState('Audio-1');
  const [creatomateSubtitleElement, setCreatomateSubtitleElement] = useState('Subtitle-1');
  const [audioBitrate, setAudioBitrate] = useState('192k');
  const [audioSampleRate, setAudioSampleRate] = useState(44100);
  const [enableSearchExpansion, setEnableSearchExpansion] = useState(true);
  const [filterAnimatedVideos, setFilterAnimatedVideos] = useState(true);
  // 音频扩展
  const [edgettsSpeed, setEdgettsSpeed] = useState(1.0);
  const [edgettsPitch, setEdgettsPitch] = useState(0);
  const [edgettsVolume, setEdgettsVolume] = useState(1.0);
  const [edgettsStyle, setEdgettsStyle] = useState('');
  const [elevenlabsModelId, setElevenlabsModelId] = useState('eleven_multilingual_v2');
  const [elevenlabsStability, setElevenlabsStability] = useState(0.5);
  const [elevenlabsSimilarityBoost, setElevenlabsSimilarityBoost] = useState(0.75);
  // 字幕样式
  const [subtitleFontSize, setSubtitleFontSize] = useState(20);
  const [subtitleFontName, setSubtitleFontName] = useState('Microsoft YaHei');
  const [subtitleFontColor, setSubtitleFontColor] = useState('&HFFFFFF');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  // 字幕高级样式（与 short-video AccountLevelConfig 对齐）
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState('&H000000');
  const [subtitleOutlineWidth, setSubtitleOutlineWidth] = useState(1);
  const [subtitleShadowColor, setSubtitleShadowColor] = useState('&H80000000');
  const [subtitleNoBackground, setSubtitleNoBackground] = useState(true);
  const [subtitleBackColor, setSubtitleBackColor] = useState('&H00000000');
  const [subtitleBorderStyle, setSubtitleBorderStyle] = useState(4);
  const [scriptLanguages, setScriptLanguages] = useState<string[]>(['zh']);
  const [subtitleLanguages, setSubtitleLanguages] = useState<string[]>(['zh']);
  const [subtitleLanguagesToShow, setSubtitleLanguagesToShow] = useState<string[]>(['zh']);
  // 视频合成
  const [creatomateTemplateId, setCreatomateTemplateId] = useState('');
  const [remotionTemplateId, setRemotionTemplateId] = useState('');
  const [videoPreset, setVideoPreset] = useState('medium');
  const [videoThreads, setVideoThreads] = useState(1);
  const [videoCrf, setVideoCrf] = useState(23);
  // Remotion 高级配置（与 short-video AccountLevelConfig 对齐）
  const [remotionCodec, setRemotionCodec] = useState('h264');
  const [remotionQuality, setRemotionQuality] = useState(80);
  const [fps, setFps] = useState(30);
  const [videoWidth, setVideoWidth] = useState(1920);
  const [videoHeight, setVideoHeight] = useState(1080);
  const [remotionAnimationsEnabled, setRemotionAnimationsEnabled] = useState(false);
  const [remotionAnimationsUseLlm, setRemotionAnimationsUseLlm] = useState(false);
  // Manim 配置（与 short-video AccountLevelConfig 对齐）
  const [manimOutputDir, setManimOutputDir] = useState('manim_output');
  const [manimEnvPath, setManimEnvPath] = useState('');
  const [useManimAnimations, setUseManimAnimations] = useState(false);
  // 素材搜索高级配置（与 short-video AccountLevelConfig 对齐）
  const [cascadeCoreKeywordFirst, setCascadeCoreKeywordFirst] = useState(true);
  const [minImageScore, setMinImageScore] = useState(70);
  const [minVideoScore, setMinVideoScore] = useState(75);
  const [imagesPerPlatform, setImagesPerPlatform] = useState(5);
  const [videosPerPlatform, setVideosPerPlatform] = useState(300);
  const [cascadeMinImagesPerSubtitle, setCascadeMinImagesPerSubtitle] = useState(3);
  const [keywordSearchMaxPerSubtitle, setKeywordSearchMaxPerSubtitle] = useState(8);
  const [firstKeywordMultiplier, setFirstKeywordMultiplier] = useState(1.0);
  const [allocationCoreKeywordBonus, setAllocationCoreKeywordBonus] = useState(0.2);
  const [keywordMinPerSubtitle, setKeywordMinPerSubtitle] = useState(5);
  const [keywordMaxPerSubtitle, setKeywordMaxPerSubtitle] = useState(8);
  const [filterCoreKeywordBonusRatio, setFilterCoreKeywordBonusRatio] = useState(0.05);
  const [filterRelevanceWeight, setFilterRelevanceWeight] = useState(0.6);
  const [filterSubtitleRelevanceWeight, setFilterSubtitleRelevanceWeight] = useState(0.4);
  const [filterBaseScoreWeight, setFilterBaseScoreWeight] = useState(0.6);
  // 视频匹配评分权重（与 short-video AccountLevelConfig 对齐）
  const [useSemanticMatching, setUseSemanticMatching] = useState(true);
  const [matchWeightBaseScore, setMatchWeightBaseScore] = useState(0.30);
  const [matchWeightKeyword, setMatchWeightKeyword] = useState(0.25);
  const [matchWeightSubtitleText, setMatchWeightSubtitleText] = useState(0.15);
  const [matchWeightDuration, setMatchWeightDuration] = useState(0.15);
  const [matchWeightSemantic, setMatchWeightSemantic] = useState(0.10);
  const [matchWeightRelevance, setMatchWeightRelevance] = useState(0.05);
  // 提示词配置
  const [promptConfigs, setPromptConfigs] = useState<Record<string, string>>({});
  const [defaultAdvancedPrompt, setDefaultAdvancedPrompt] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<Record<string, string>>({});
  const [expandPromptTemplates, setExpandPromptTemplates] = useState(false);
  // 平台权重
  const [platformWeights, setPlatformWeights] = useState('');
  const [rssSources, setRssSources] = useState('');

  useImperativeHandle(ref, () => ({
    getConfig: () => {
      const pc: Record<string, { version: number; variant?: string }> = {};
      Object.entries(promptConfigs).forEach(([name, val]) => {
        if (!val || String(val).startsWith('default-') || String(val).startsWith('custom-')) return;
        const prompts = promptsGrouped[name] || [];
        const p = prompts.find((x) => x.id === val);
        if (p) {
          pc[name] = { version: p.version, ...(p.variant ? { variant: p.variant } : {}) };
        }
      });
      const rssList = (rssSources || '')
        .split(/\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      return {
        ...(rssList.length > 0 ? { rss_sources: rssList } : {}),
        // 平台基础配置（与 short-video 前端 AccountLevelConfig 对齐）
        use_free_videos: effectiveUseFreeVideos,
        compose_provider: composeProvider || undefined,
        audio_provider: audioProvider,
        llm_model_script: llmModelScript || undefined,
        llm_model_script_provider: llmModelScriptProvider || undefined,
        llm_model_search_terms: llmModelSearchTerms || undefined,
        llm_model_search_terms_provider: llmModelSearchTermsProvider || undefined,
        llm_model_key_points: llmModelKeyPoints || undefined,
        llm_model_key_points_provider: llmModelKeyPointsProvider || undefined,
        llm_model_keywords: llmModelKeywords || undefined,
        llm_model_keywords_provider: llmModelKeywordsProvider || undefined,
        // 音频配置
        edgetts_voice_id: audioProvider === 'edgetts' ? edgettsVoiceId : undefined,
        edgetts_speed: audioProvider === 'edgetts' ? edgettsSpeed : undefined,
        edgetts_pitch: audioProvider === 'edgetts' ? edgettsPitch : undefined,
        edgetts_volume: audioProvider === 'edgetts' ? edgettsVolume : undefined,
        edgetts_style: audioProvider === 'edgetts' && edgettsStyle ? edgettsStyle : undefined,
        edgetts_styledegree: audioProvider === 'edgetts' ? edgettsStyledegree : undefined,
        elevenlabs_voice_id: audioProvider === 'elevenlabs' ? elevenlabsVoiceId : undefined,
        elevenlabs_model_id: audioProvider === 'elevenlabs' ? elevenlabsModelId : undefined,
        elevenlabs_stability: audioProvider === 'elevenlabs' ? elevenlabsStability : undefined,
        elevenlabs_similarity_boost: audioProvider === 'elevenlabs' ? elevenlabsSimilarityBoost : undefined,
        // 字幕与多语言
        subtitle_font_size: subtitleFontSize ?? undefined,
        subtitle_font_name: subtitleFontName || undefined,
        subtitle_font_color: subtitleFontColor || undefined,
        subtitle_position: subtitlePosition || undefined,
        subtitle_outline_color: subtitleOutlineColor || undefined,
        subtitle_outline_width: subtitleOutlineWidth ?? undefined,
        subtitle_shadow_color: subtitleShadowColor || undefined,
        subtitle_no_background: subtitleNoBackground,
        subtitle_back_color: subtitleBackColor || undefined,
        subtitle_border_style: subtitleBorderStyle ?? undefined,
        script_languages: scriptLanguages.length > 0 ? scriptLanguages : undefined,
        script_source_language: scriptSourceLanguage || undefined,
        subtitle_languages: subtitleLanguages.length > 0 ? subtitleLanguages : undefined,
        subtitle_source_language: subtitleSourceLanguage || undefined,
        subtitle_languages_to_show: subtitleLanguagesToShow.length > 0 ? subtitleLanguagesToShow : undefined,
        // 提示词配置
        prompt_configs: Object.keys(pc).length > 0 ? pc : undefined,
        default_advanced_prompt: defaultAdvancedPrompt?.trim() || undefined,
        prompt_templates: (() => {
          const tpl: Record<string, string> = {};
          PROMPT_CONFIG_NAMES.forEach((name) => {
            const v = promptTemplates[name]?.trim();
            if (v) tpl[name] = v;
          });
          return Object.keys(tpl).length > 0 ? tpl : undefined;
        })(),
        // 视频合成配置
        creatomate_template_id: composeProvider === 'creatomate' && creatomateTemplateId ? creatomateTemplateId : undefined,
        creatomate_image_element_prefix: composeProvider === 'creatomate' ? creatomateImagePrefix : undefined,
        creatomate_audio_element_name: composeProvider === 'creatomate' ? creatomateAudioElement : undefined,
        creatomate_subtitle_element_name: composeProvider === 'creatomate' ? creatomateSubtitleElement : undefined,
        remotion_template: composeProvider === 'remotion' && remotionTemplateId ? remotionTemplateId : undefined,
        remotion_codec: composeProvider === 'remotion' || composeProvider === 'manim' ? remotionCodec : undefined,
        remotion_quality: composeProvider === 'remotion' || composeProvider === 'manim' ? remotionQuality : undefined,
        fps: composeProvider === 'remotion' || composeProvider === 'manim' ? fps : undefined,
        video_width: composeProvider === 'remotion' || composeProvider === 'manim' ? videoWidth : undefined,
        video_height: composeProvider === 'remotion' || composeProvider === 'manim' ? videoHeight : undefined,
        remotion_animations: composeProvider === 'remotion' ? { enabled: remotionAnimationsEnabled, use_llm: remotionAnimationsUseLlm } : undefined,
        manim_output_dir: composeProvider === 'manim' ? manimOutputDir : undefined,
        manim_env_path: composeProvider === 'manim' ? manimEnvPath : undefined,
        use_manim_animations: composeProvider === 'manim' ? useManimAnimations : undefined,
        video_preset: videoPreset || undefined,
        video_threads: videoThreads ?? undefined,
        video_crf: videoCrf ?? undefined,
        audio_bitrate: audioBitrate || undefined,
        audio_sample_rate: audioSampleRate || undefined,
        // 素材与匹配
        image_platforms: imagePlatforms.length > 0 ? imagePlatforms : undefined,
        video_platforms: videoPlatforms.length > 0 ? videoPlatforms : undefined,
        platform_weights: platformWeights?.trim() ? (() => { try { return JSON.parse(platformWeights); } catch { return undefined; } })() : undefined,
        enable_search_expansion: enableSearchExpansion,
        filter_animated_videos: filterAnimatedVideos,
        cascade_core_keyword_first: cascadeCoreKeywordFirst,
        min_image_score: minImageScore ?? undefined,
        min_video_score: minVideoScore ?? undefined,
        images_per_platform: imagesPerPlatform ?? undefined,
        videos_per_platform: videosPerPlatform ?? undefined,
        cascade_min_images_per_subtitle: cascadeMinImagesPerSubtitle ?? undefined,
        keyword_search_max_per_subtitle: keywordSearchMaxPerSubtitle ?? undefined,
        first_keyword_multiplier: firstKeywordMultiplier ?? undefined,
        allocation_core_keyword_bonus: allocationCoreKeywordBonus ?? undefined,
        keyword_min_per_subtitle: keywordMinPerSubtitle ?? undefined,
        keyword_max_per_subtitle: keywordMaxPerSubtitle ?? undefined,
        filter_core_keyword_bonus_ratio: filterCoreKeywordBonusRatio ?? undefined,
        filter_relevance_weight: filterRelevanceWeight ?? undefined,
        filter_subtitle_relevance_weight: filterSubtitleRelevanceWeight ?? undefined,
        filter_base_score_weight: filterBaseScoreWeight ?? undefined,
        use_semantic_matching: useSemanticMatching,
        match_weight_base_score: matchWeightBaseScore ?? undefined,
        match_weight_keyword: matchWeightKeyword ?? undefined,
        match_weight_subtitle_text: matchWeightSubtitleText ?? undefined,
        match_weight_duration: matchWeightDuration ?? undefined,
        match_weight_semantic: matchWeightSemantic ?? undefined,
        match_weight_relevance: matchWeightRelevance ?? undefined,
      };
    },
    setConfig: (c: Record<string, unknown>) => {
      // 平台基础配置（与 short-video 前端 AccountLevelConfig 对齐）
      if (c.use_free_videos !== undefined) {
        const v = !!c.use_free_videos;
        setUseFreeVideos(v);
        onUseFreeVideosChange?.(v);
      }
      if (c.compose_provider) setComposeProvider(String(c.compose_provider));
      if (c.audio_provider) setAudioProvider(String(c.audio_provider) as 'edgetts' | 'elevenlabs');
      if (c.llm_model_script) setLlmModelScript(String(c.llm_model_script));
      if (c.llm_model_script_provider) setLlmModelScriptProvider(String(c.llm_model_script_provider));
      if (c.llm_model_search_terms) setLlmModelSearchTerms(String(c.llm_model_search_terms));
      if (c.llm_model_search_terms_provider) setLlmModelSearchTermsProvider(String(c.llm_model_search_terms_provider));
      if (c.llm_model_key_points) setLlmModelKeyPoints(String(c.llm_model_key_points));
      if (c.llm_model_key_points_provider) setLlmModelKeyPointsProvider(String(c.llm_model_key_points_provider));
      if (c.llm_model_keywords) setLlmModelKeywords(String(c.llm_model_keywords));
      if (c.llm_model_keywords_provider) setLlmModelKeywordsProvider(String(c.llm_model_keywords_provider));
      // 音频配置
      if (c.edgetts_voice_id) setEdgettsVoiceId(String(c.edgetts_voice_id));
      if (c.edgetts_speed != null) setEdgettsSpeed(Number(c.edgetts_speed));
      if (c.edgetts_pitch != null) setEdgettsPitch(Number(c.edgetts_pitch));
      if (c.edgetts_volume != null) setEdgettsVolume(Number(c.edgetts_volume));
      if (c.edgetts_style != null) setEdgettsStyle(String(c.edgetts_style));
      if (c.edgetts_styledegree != null) setEdgettsStyledegree(Number(c.edgetts_styledegree));
      if (c.elevenlabs_voice_id) setElevenlabsVoiceId(String(c.elevenlabs_voice_id));
      if (c.elevenlabs_model_id) setElevenlabsModelId(String(c.elevenlabs_model_id));
      if (c.elevenlabs_stability != null) setElevenlabsStability(Number(c.elevenlabs_stability));
      if (c.elevenlabs_similarity_boost != null) setElevenlabsSimilarityBoost(Number(c.elevenlabs_similarity_boost));
      // 字幕与多语言
      if (c.subtitle_font_size != null) setSubtitleFontSize(Number(c.subtitle_font_size));
      if (c.subtitle_font_name) setSubtitleFontName(String(c.subtitle_font_name));
      if (c.subtitle_font_color) setSubtitleFontColor(String(c.subtitle_font_color));
      if (c.subtitle_position) setSubtitlePosition(String(c.subtitle_position));
      if (c.subtitle_outline_color) setSubtitleOutlineColor(String(c.subtitle_outline_color));
      if (c.subtitle_outline_width != null) setSubtitleOutlineWidth(Number(c.subtitle_outline_width));
      if (c.subtitle_shadow_color) setSubtitleShadowColor(String(c.subtitle_shadow_color));
      if (c.subtitle_no_background !== undefined) setSubtitleNoBackground(!!c.subtitle_no_background);
      if (c.subtitle_back_color) setSubtitleBackColor(String(c.subtitle_back_color));
      if (c.subtitle_border_style != null) setSubtitleBorderStyle(Number(c.subtitle_border_style));
      if (Array.isArray(c.script_languages)) setScriptLanguages(c.script_languages);
      if (c.script_source_language) setScriptSourceLanguage(String(c.script_source_language));
      if (Array.isArray(c.subtitle_languages)) setSubtitleLanguages(c.subtitle_languages);
      if (c.subtitle_source_language) setSubtitleSourceLanguage(String(c.subtitle_source_language));
      if (Array.isArray(c.subtitle_languages_to_show)) setSubtitleLanguagesToShow(c.subtitle_languages_to_show);
      // 提示词配置
      const pc: Record<string, string> = {};
      if (c.prompt_configs && typeof c.prompt_configs === 'object' && Object.keys(promptsGrouped).length > 0) {
        Object.entries(c.prompt_configs as Record<string, unknown>).forEach(([name, val]) => {
          if (val && typeof val === 'object' && 'version' in val) {
            const v = val as { version?: number; variant?: string };
            const prompts = promptsGrouped[name] || [];
            const matched = prompts.find(
              (p) => p.version === v.version && (v.variant ? p.variant === v.variant : !p.variant)
            );
            if (matched) pc[name] = matched.id;
          }
        });
      }
      if (c.prompt_templates && typeof c.prompt_templates === 'object') {
        const tpl: Record<string, string> = {};
        Object.entries(c.prompt_templates as Record<string, unknown>).forEach(([name, val]) => {
          if (typeof val === 'string') tpl[name] = val;
        });
        setPromptTemplates((prev) => ({ ...prev, ...tpl }));
        Object.keys(tpl).forEach((name) => {
          if ((PROMPT_CORE_NAMES as readonly string[]).includes(name)) pc[name] = `custom-${name}`;
        });
      }
      if (Object.keys(pc).length > 0) setPromptConfigs((prev) => ({ ...prev, ...pc }));
      if (c.default_advanced_prompt != null) setDefaultAdvancedPrompt(String(c.default_advanced_prompt));
      // 视频合成配置
      if (c.creatomate_template_id) setCreatomateTemplateId(String(c.creatomate_template_id));
      if (c.creatomate_image_element_prefix) setCreatomateImagePrefix(String(c.creatomate_image_element_prefix));
      if (c.creatomate_audio_element_name) setCreatomateAudioElement(String(c.creatomate_audio_element_name));
      if (c.creatomate_subtitle_element_name) setCreatomateSubtitleElement(String(c.creatomate_subtitle_element_name));
      if (c.remotion_template) setRemotionTemplateId(String(c.remotion_template));
      if (c.remotion_codec) setRemotionCodec(String(c.remotion_codec));
      if (c.remotion_quality != null) setRemotionQuality(Number(c.remotion_quality));
      if (c.fps != null) setFps(Number(c.fps));
      if (c.video_width != null) setVideoWidth(Number(c.video_width));
      if (c.video_height != null) setVideoHeight(Number(c.video_height));
      if (c.remotion_animations && typeof c.remotion_animations === 'object') {
        const anims = c.remotion_animations as { enabled?: boolean; use_llm?: boolean };
        if (anims.enabled !== undefined) setRemotionAnimationsEnabled(anims.enabled);
        if (anims.use_llm !== undefined) setRemotionAnimationsUseLlm(anims.use_llm);
      }
      if (c.manim_output_dir) setManimOutputDir(String(c.manim_output_dir));
      if (c.manim_env_path) setManimEnvPath(String(c.manim_env_path));
      if (c.use_manim_animations !== undefined) setUseManimAnimations(!!c.use_manim_animations);
      if (c.video_preset) setVideoPreset(String(c.video_preset));
      if (c.video_threads != null) setVideoThreads(Number(c.video_threads));
      if (c.video_crf != null) setVideoCrf(Number(c.video_crf));
      if (c.audio_bitrate) setAudioBitrate(String(c.audio_bitrate));
      if (c.audio_sample_rate != null) setAudioSampleRate(Number(c.audio_sample_rate));
      // 素材与匹配
      if (Array.isArray(c.image_platforms)) setImagePlatforms(c.image_platforms);
      if (Array.isArray(c.video_platforms)) setVideoPlatforms(c.video_platforms);
      if (c.platform_weights && typeof c.platform_weights === 'object') setPlatformWeights(JSON.stringify(c.platform_weights, null, 2));
      else if (typeof c.platform_weights === 'string') setPlatformWeights(c.platform_weights);
      if (c.enable_search_expansion !== undefined) setEnableSearchExpansion(!!c.enable_search_expansion);
      if (c.filter_animated_videos !== undefined) setFilterAnimatedVideos(!!c.filter_animated_videos);
      if (c.cascade_core_keyword_first !== undefined) setCascadeCoreKeywordFirst(!!c.cascade_core_keyword_first);
      if (c.min_image_score != null) setMinImageScore(Number(c.min_image_score));
      if (c.min_video_score != null) setMinVideoScore(Number(c.min_video_score));
      if (c.images_per_platform != null) setImagesPerPlatform(Number(c.images_per_platform));
      if (c.videos_per_platform != null) setVideosPerPlatform(Number(c.videos_per_platform));
      if (c.cascade_min_images_per_subtitle != null) setCascadeMinImagesPerSubtitle(Number(c.cascade_min_images_per_subtitle));
      if (c.keyword_search_max_per_subtitle != null) setKeywordSearchMaxPerSubtitle(Number(c.keyword_search_max_per_subtitle));
      if (c.first_keyword_multiplier != null) setFirstKeywordMultiplier(Number(c.first_keyword_multiplier));
      if (c.allocation_core_keyword_bonus != null) setAllocationCoreKeywordBonus(Number(c.allocation_core_keyword_bonus));
      if (c.keyword_min_per_subtitle != null) setKeywordMinPerSubtitle(Number(c.keyword_min_per_subtitle));
      if (c.keyword_max_per_subtitle != null) setKeywordMaxPerSubtitle(Number(c.keyword_max_per_subtitle));
      if (c.filter_core_keyword_bonus_ratio != null) setFilterCoreKeywordBonusRatio(Number(c.filter_core_keyword_bonus_ratio));
      if (c.filter_relevance_weight != null) setFilterRelevanceWeight(Number(c.filter_relevance_weight));
      if (c.filter_subtitle_relevance_weight != null) setFilterSubtitleRelevanceWeight(Number(c.filter_subtitle_relevance_weight));
      if (c.filter_base_score_weight != null) setFilterBaseScoreWeight(Number(c.filter_base_score_weight));
      if (c.use_semantic_matching !== undefined) setUseSemanticMatching(!!c.use_semantic_matching);
      if (c.match_weight_base_score != null) setMatchWeightBaseScore(Number(c.match_weight_base_score));
      if (c.match_weight_keyword != null) setMatchWeightKeyword(Number(c.match_weight_keyword));
      if (c.match_weight_subtitle_text != null) setMatchWeightSubtitleText(Number(c.match_weight_subtitle_text));
      if (c.match_weight_duration != null) setMatchWeightDuration(Number(c.match_weight_duration));
      if (c.match_weight_semantic != null) setMatchWeightSemantic(Number(c.match_weight_semantic));
      if (c.match_weight_relevance != null) setMatchWeightRelevance(Number(c.match_weight_relevance));
    },
  }));


  useEffect(() => {
    let cancelled = false;
    setLoadingPrompts(true);
    const load = async () => {
      const configUrl = platformAccountId
        ? `/short-video/integration-config?platform_account_id=${encodeURIComponent(platformAccountId)}`
        : '/short-video/integration-config';
      const [configRes, promptsRes] = await Promise.all([
        fetch(configUrl),
        fetch('/short-video/prompts/grouped/by-name?is_active=true&include_defaults=true'),
      ]);
      if (cancelled) return;
      const data = configRes.ok ? await configRes.json() : null;
      const grouped = promptsRes.ok ? await promptsRes.json() : null;
      if (!data || typeof data !== 'object') return;
      if (grouped && typeof grouped === 'object') setPromptsGrouped(grouped as Record<string, PromptOption[]>);
      const c = data as Record<string, unknown>;
      // 平台基础配置（与 short-video 前端 AccountLevelConfig 对齐）
      if (c.use_free_videos !== undefined) {
        const v = !!c.use_free_videos;
        setUseFreeVideos(v);
        onUseFreeVideosChange?.(v);
      }
      if (c.compose_provider) setComposeProvider(String(c.compose_provider));
      if (c.audio_provider) setAudioProvider(String(c.audio_provider) as 'edgetts' | 'elevenlabs');
      if (c.llm_model_script) setLlmModelScript(String(c.llm_model_script));
      if (c.llm_model_script_provider) setLlmModelScriptProvider(String(c.llm_model_script_provider));
      if (c.llm_model_search_terms) setLlmModelSearchTerms(String(c.llm_model_search_terms));
      if (c.llm_model_search_terms_provider) setLlmModelSearchTermsProvider(String(c.llm_model_search_terms_provider));
      if (c.llm_model_key_points) setLlmModelKeyPoints(String(c.llm_model_key_points));
      if (c.llm_model_key_points_provider) setLlmModelKeyPointsProvider(String(c.llm_model_key_points_provider));
      if (c.llm_model_keywords) setLlmModelKeywords(String(c.llm_model_keywords));
      if (c.llm_model_keywords_provider) setLlmModelKeywordsProvider(String(c.llm_model_keywords_provider));
      // 音频配置
      if (c.edgetts_voice_id) setEdgettsVoiceId(String(c.edgetts_voice_id));
      if (c.edgetts_speed != null) setEdgettsSpeed(Number(c.edgetts_speed));
      if (c.edgetts_pitch != null) setEdgettsPitch(Number(c.edgetts_pitch));
      if (c.edgetts_volume != null) setEdgettsVolume(Number(c.edgetts_volume));
      if (c.edgetts_style != null) setEdgettsStyle(String(c.edgetts_style));
      if (c.edgetts_styledegree != null) setEdgettsStyledegree(Number(c.edgetts_styledegree));
      if (c.elevenlabs_voice_id) setElevenlabsVoiceId(String(c.elevenlabs_voice_id));
      if (c.elevenlabs_model_id) setElevenlabsModelId(String(c.elevenlabs_model_id));
      if (c.elevenlabs_stability != null) setElevenlabsStability(Number(c.elevenlabs_stability));
      if (c.elevenlabs_similarity_boost != null) setElevenlabsSimilarityBoost(Number(c.elevenlabs_similarity_boost));
      // 字幕与多语言
      if (c.subtitle_font_size != null) setSubtitleFontSize(Number(c.subtitle_font_size));
      if (c.subtitle_font_name) setSubtitleFontName(String(c.subtitle_font_name));
      if (c.subtitle_font_color) setSubtitleFontColor(String(c.subtitle_font_color));
      if (c.subtitle_position) setSubtitlePosition(String(c.subtitle_position));
      if (c.subtitle_outline_color) setSubtitleOutlineColor(String(c.subtitle_outline_color));
      if (c.subtitle_outline_width != null) setSubtitleOutlineWidth(Number(c.subtitle_outline_width));
      if (c.subtitle_shadow_color) setSubtitleShadowColor(String(c.subtitle_shadow_color));
      if (c.subtitle_no_background !== undefined) setSubtitleNoBackground(!!c.subtitle_no_background);
      if (c.subtitle_back_color) setSubtitleBackColor(String(c.subtitle_back_color));
      if (c.subtitle_border_style != null) setSubtitleBorderStyle(Number(c.subtitle_border_style));
      if (Array.isArray(c.script_languages)) setScriptLanguages(c.script_languages);
      if (c.script_source_language) setScriptSourceLanguage(String(c.script_source_language));
      if (Array.isArray(c.subtitle_languages)) setSubtitleLanguages(c.subtitle_languages);
      if (c.subtitle_source_language) setSubtitleSourceLanguage(String(c.subtitle_source_language));
      if (Array.isArray(c.subtitle_languages_to_show)) setSubtitleLanguagesToShow(c.subtitle_languages_to_show);
      // 提示词配置
      const loadPc: Record<string, string> = {};
      if (c.prompt_configs && typeof c.prompt_configs === 'object' && grouped && typeof grouped === 'object') {
        Object.entries(c.prompt_configs as Record<string, unknown>).forEach(([name, val]) => {
          if (val && typeof val === 'object' && 'version' in val) {
            const v = val as { version?: number; variant?: string };
            const prompts = (grouped as Record<string, PromptOption[]>)[name] || [];
            const matched = prompts.find(
              (p) => p.version === v.version && (v.variant ? p.variant === v.variant : !p.variant)
            );
            if (matched) loadPc[name] = matched.id;
          }
        });
      }
      if (c.prompt_templates && typeof c.prompt_templates === 'object' && Object.keys(c.prompt_templates as object).length > 0) {
        const tpl: Record<string, string> = {};
        Object.entries(c.prompt_templates as Record<string, unknown>).forEach(([name, val]) => {
          if (typeof val === 'string') tpl[name] = val;
        });
        setPromptTemplates(tpl);
        Object.keys(tpl).forEach((name) => {
          if ((PROMPT_CORE_NAMES as readonly string[]).includes(name)) loadPc[name] = `custom-${name}`;
        });
      }
      if (Object.keys(loadPc).length > 0) setPromptConfigs(loadPc);
      if (c.default_advanced_prompt != null) setDefaultAdvancedPrompt(String(c.default_advanced_prompt));
      if (!(c.prompt_templates && typeof c.prompt_templates === 'object' && Object.keys(c.prompt_templates as object).length > 0) && grouped && typeof grouped === 'object') {
        const initTpl: Record<string, string> = {};
        PROMPT_CONFIG_NAMES.forEach((name) => {
          const first = (grouped as Record<string, Array<{ template?: string }>>)?.[name]?.[0];
          if (first?.template) initTpl[name] = first.template;
        });
        if (Object.keys(initTpl).length > 0) setPromptTemplates(initTpl);
      }
      if ((!c.default_advanced_prompt || c.default_advanced_prompt === '') && grouped && typeof grouped === 'object') {
        const voiceScript = (grouped as Record<string, Array<{ template?: string }>>)?.voice_script?.[0];
        const firstGroup = Object.values(grouped as Record<string, Array<{ template?: string }>>)[0];
        const found = voiceScript?.template || firstGroup?.[0]?.template || '';
        if (found) setDefaultAdvancedPrompt(found);
      }
      // 视频合成配置
      if (c.creatomate_template_id) setCreatomateTemplateId(String(c.creatomate_template_id));
      if (c.creatomate_image_element_prefix) setCreatomateImagePrefix(String(c.creatomate_image_element_prefix));
      if (c.creatomate_audio_element_name) setCreatomateAudioElement(String(c.creatomate_audio_element_name));
      if (c.creatomate_subtitle_element_name) setCreatomateSubtitleElement(String(c.creatomate_subtitle_element_name));
      if (c.remotion_template) setRemotionTemplateId(String(c.remotion_template));
      if (c.remotion_codec) setRemotionCodec(String(c.remotion_codec));
      if (c.remotion_quality != null) setRemotionQuality(Number(c.remotion_quality));
      if (c.fps != null) setFps(Number(c.fps));
      if (c.video_width != null) setVideoWidth(Number(c.video_width));
      if (c.video_height != null) setVideoHeight(Number(c.video_height));
      if (c.remotion_animations && typeof c.remotion_animations === 'object') {
        const anims = c.remotion_animations as { enabled?: boolean; use_llm?: boolean };
        if (anims.enabled !== undefined) setRemotionAnimationsEnabled(anims.enabled);
        if (anims.use_llm !== undefined) setRemotionAnimationsUseLlm(anims.use_llm);
      }
      if (c.manim_output_dir) setManimOutputDir(String(c.manim_output_dir));
      if (c.manim_env_path) setManimEnvPath(String(c.manim_env_path));
      if (c.use_manim_animations !== undefined) setUseManimAnimations(!!c.use_manim_animations);
      if (c.video_preset) setVideoPreset(String(c.video_preset));
      if (c.video_threads != null) setVideoThreads(Number(c.video_threads));
      if (c.video_crf != null) setVideoCrf(Number(c.video_crf));
      if (c.audio_bitrate) setAudioBitrate(String(c.audio_bitrate));
      if (c.audio_sample_rate != null) setAudioSampleRate(Number(c.audio_sample_rate));
      // 素材与匹配
      if (Array.isArray(c.image_platforms)) setImagePlatforms(c.image_platforms);
      if (Array.isArray(c.video_platforms)) setVideoPlatforms(c.video_platforms);
      if (c.platform_weights && typeof c.platform_weights === 'object') setPlatformWeights(JSON.stringify(c.platform_weights, null, 2));
      else if (typeof c.platform_weights === 'string') setPlatformWeights(c.platform_weights);
      if (c.enable_search_expansion !== undefined) setEnableSearchExpansion(!!c.enable_search_expansion);
      if (c.filter_animated_videos !== undefined) setFilterAnimatedVideos(!!c.filter_animated_videos);
      if (c.cascade_core_keyword_first !== undefined) setCascadeCoreKeywordFirst(!!c.cascade_core_keyword_first);
      if (c.min_image_score != null) setMinImageScore(Number(c.min_image_score));
      if (c.min_video_score != null) setMinVideoScore(Number(c.min_video_score));
      if (c.images_per_platform != null) setImagesPerPlatform(Number(c.images_per_platform));
      if (c.videos_per_platform != null) setVideosPerPlatform(Number(c.videos_per_platform));
      if (c.cascade_min_images_per_subtitle != null) setCascadeMinImagesPerSubtitle(Number(c.cascade_min_images_per_subtitle));
      if (c.keyword_search_max_per_subtitle != null) setKeywordSearchMaxPerSubtitle(Number(c.keyword_search_max_per_subtitle));
      if (c.first_keyword_multiplier != null) setFirstKeywordMultiplier(Number(c.first_keyword_multiplier));
      if (c.allocation_core_keyword_bonus != null) setAllocationCoreKeywordBonus(Number(c.allocation_core_keyword_bonus));
      if (c.keyword_min_per_subtitle != null) setKeywordMinPerSubtitle(Number(c.keyword_min_per_subtitle));
      if (c.keyword_max_per_subtitle != null) setKeywordMaxPerSubtitle(Number(c.keyword_max_per_subtitle));
      if (c.filter_core_keyword_bonus_ratio != null) setFilterCoreKeywordBonusRatio(Number(c.filter_core_keyword_bonus_ratio));
      if (c.filter_relevance_weight != null) setFilterRelevanceWeight(Number(c.filter_relevance_weight));
      if (c.filter_subtitle_relevance_weight != null) setFilterSubtitleRelevanceWeight(Number(c.filter_subtitle_relevance_weight));
      if (c.filter_base_score_weight != null) setFilterBaseScoreWeight(Number(c.filter_base_score_weight));
      if (c.use_semantic_matching !== undefined) setUseSemanticMatching(!!c.use_semantic_matching);
      if (c.match_weight_base_score != null) setMatchWeightBaseScore(Number(c.match_weight_base_score));
      if (c.match_weight_keyword != null) setMatchWeightKeyword(Number(c.match_weight_keyword));
      if (c.match_weight_subtitle_text != null) setMatchWeightSubtitleText(Number(c.match_weight_subtitle_text));
      if (c.match_weight_duration != null) setMatchWeightDuration(Number(c.match_weight_duration));
      if (c.match_weight_semantic != null) setMatchWeightSemantic(Number(c.match_weight_semantic));
      if (c.match_weight_relevance != null) setMatchWeightRelevance(Number(c.match_weight_relevance));
    };
    load().finally(() => {
      if (!cancelled) setLoadingPrompts(false);
    });
    return () => { cancelled = true; };
  }, [fetch, platformAccountId]);

  // 按模式过滤：视频模式显示视频相关，图片模式显示图片相关
  const promptCoreNamesFiltered = PROMPT_CORE_NAMES.filter((n) => (n === 'image_prompts' ? !effectiveUseFreeVideos : true));
  const promptExtendedNamesFiltered = PROMPT_EXTENDED_NAMES.filter((n) => (n === 'video_prompts' ? effectiveUseFreeVideos : true));

  return (
    <form className="flex flex-col gap-[16px] text-[13px]" onSubmit={(e) => e.preventDefault()}>
      {/* 1. 平台概览 - 账号 + 视频模式开关在右侧（内嵌时由父级展示，此处隐藏） */}
      {!hidePlatformOverview && platformAccountId && (() => {
        const acc = platformAccounts.find((a) => a.id === platformAccountId);
        if (!acc) return null;
        return (
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[10px]">
              <span className="text-[#612BD3] text-[16px]">⚙️</span>
              <span className="text-[14px] font-[600]">{t('platform_overview', '平台概览')}</span>
            </div>
            <div className="rounded-[10px] border border-newBorder bg-newSettings/50 p-[18px] flex items-center justify-between gap-[18px]">
              <div className="flex items-center gap-[18px] min-w-0">
                {(() => {
                  let avatarUrl = acc.avatar_url;
                  if (avatarUrl?.includes('/uploads/')) {
                    try {
                      const u = new URL(avatarUrl);
                      if (u.pathname.startsWith('/uploads/')) avatarUrl = u.pathname;
                    } catch {
                      /* skip */
                    }
                  }
                  return (
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${(integrationIdentifier || acc.platform || 'youtube').toLowerCase()}.png`}
                  src={avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/')) ? avatarUrl : `/icons/platforms/${(integrationIdentifier || acc.platform || 'youtube').toLowerCase()}.png`}
                  className="rounded-[10px] object-cover shrink-0"
                  alt=""
                  width={56}
                  height={56}
                />
                  );
                })()}
                <div className="flex flex-col gap-[6px] min-w-0">
                  <div className="text-[15px] font-[600] truncate">{acc.name}</div>
                  <div className="text-[12px] text-textItemBlur">
                    {t('platform', '平台')}: {acc.platform}
                  </div>
                  <div className="text-[11px] text-textItemBlur font-mono truncate">
                    ID: {acc.id}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-[4px] shrink-0">
                <span className="text-[12px]">{t('video_mode', '视频模式')}</span>
                <ToggleSwitch checked={effectiveUseFreeVideos} onChange={effectiveSetUseFreeVideos} />
                <span className="text-[11px] text-textItemBlur">{t('use_video_material', '使用视频素材')}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. 语音与字幕 - 语音引擎、语音参数调整、字幕样式 */}
      <CollapsibleSection title={t('voice_and_subtitle', '语音与字幕')} icon="🎤" defaultOpen={false}>
      <div className="flex flex-col gap-[10px]">
        <div className="flex flex-col gap-[10px]">
          <label className="flex flex-col gap-[4px]">
            <span>{t('audio_provider', '语音引擎')}</span>
            <select
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={audioProvider}
              onChange={(e) => setAudioProvider(e.target.value as 'edgetts' | 'elevenlabs')}
              name="audio_provider"
            >
              {AUDIO_PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {audioProvider === 'edgetts' && (
            <>
              <label className="flex flex-col gap-[4px]">
                <span>{t('edgetts_voice', 'EdgeTTS 声音')}</span>
                <select
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={edgettsVoiceId}
                  onChange={(e) => setEdgettsVoiceId(e.target.value)}
                  name="edgetts_voice_id"
                >
                  {EDGETTS_VOICES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-[12px]">
                <div className="text-[12px] font-[500]">{t('voice_param_adjust', '语音参数调整')}</div>
                <WeightSlider label={t('edgetts_speed', '语速')} value={edgettsSpeed} onChange={(v) => setEdgettsSpeed(v)} min={0.5} max={2} step={0.1} format={(v) => v.toFixed(1)} />
                <WeightSlider label={t('edgetts_pitch', '音调')} value={edgettsPitch} onChange={(v) => setEdgettsPitch(v)} min={-50} max={50} step={1} />
                <WeightSlider label={t('edgetts_volume', '音量')} value={edgettsVolume} onChange={(v) => setEdgettsVolume(v)} min={0} max={1} step={0.1} format={(v) => v.toFixed(1)} />
                <label className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{t('edgetts_style', '语音风格')}</span>
                  <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={edgettsStyle} onChange={(e) => setEdgettsStyle(e.target.value)} placeholder="gentle" />
                </label>
                <WeightSlider label={t('edgetts_style_degree', '风格强度')} value={edgettsStyledegree} onChange={(v) => setEdgettsStyledegree(v)} min={0} max={1} step={0.1} format={(v) => v.toFixed(1)} />
              </div>
            </>
          )}
          {audioProvider === 'elevenlabs' && (
            <>
              <label className="flex flex-col gap-[4px]">
                <span>{t('elevenlabs_voice', 'ElevenLabs 声音')}</span>
                <select
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={elevenlabsVoiceId}
                  onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                  name="elevenlabs_voice_id"
                >
                  {ELEVENLABS_VOICES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="flex items-center gap-[4px] text-[12px] text-textItemBlur hover:text-textColor" onClick={() => setShowVoiceTuning((v) => !v)}>
                {showVoiceTuning ? '▼' : '▶'} {t('elevenlabs_advanced', '模型/稳定性/相似度')}
              </button>
              {showVoiceTuning && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-[10px]">
                  <label className="flex flex-col gap-[4px]">
                    <span>{t('elevenlabs_model_id', '模型 ID')}</span>
                    <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={elevenlabsModelId} onChange={(e) => setElevenlabsModelId(e.target.value)} placeholder="eleven_multilingual_v2" />
                  </label>
                  <label className="flex flex-col gap-[4px]">
                    <span>{t('elevenlabs_stability', '稳定性 0-1')}</span>
                    <input type="number" step={0.1} min={0} max={1} className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={elevenlabsStability} onChange={(e) => setElevenlabsStability(Number(e.target.value) || 0.5)} />
                  </label>
                  <label className="flex flex-col gap-[4px]">
                    <span>{t('elevenlabs_similarity_boost', '相似度 0-1')}</span>
                    <input type="number" step={0.1} min={0} max={1} className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={elevenlabsSimilarityBoost} onChange={(e) => setElevenlabsSimilarityBoost(Number(e.target.value) || 0.75)} />
                  </label>
                </div>
              )}
            </>
          )}

          {/* 字幕样式 - 按设计图 */}
          <div className="flex flex-col gap-[12px]">
            <div className="text-[12px] font-[500]">{t('subtitle_style', '字幕样式')}</div>
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('font_size', '字体大小')}</span>
                <input type="number" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={subtitleFontSize} onChange={(e) => setSubtitleFontSize(Number(e.target.value) || 20)} />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('font', '字体')}</span>
                <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={subtitleFontName} onChange={(e) => setSubtitleFontName(e.target.value)} placeholder="Microsoft YaHei" />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('subtitle_font_color', '字体颜色 ASS')}</span>
                <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={subtitleFontColor} onChange={(e) => setSubtitleFontColor(e.target.value)} placeholder="&HFFFFFF" />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('subtitle_position', '位置')}</span>
                <select className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={subtitlePosition} onChange={(e) => setSubtitlePosition(e.target.value)}>
                  <option value="top">顶部</option>
                  <option value="center">中部</option>
                  <option value="bottom">底部</option>
                </select>
              </label>
            </div>
          </div>
          <button type="button" className="flex items-center gap-[4px] text-[12px] text-textItemBlur hover:text-textColor" onClick={() => setShowSubtitleAdvanced((v) => !v)}>
            {showSubtitleAdvanced ? '▼' : '▶'} {t('subtitle_advanced', '字幕高级样式')}
          </button>
          {showSubtitleAdvanced && (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-[10px]">
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_outline_color', '描边颜色 ASS')}</span>
              <input
                type="text"
                className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                value={subtitleOutlineColor}
                onChange={(e) => setSubtitleOutlineColor(e.target.value)}
                placeholder="&H000000"
              />
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_outline_width', '描边宽度')}</span>
              <input
                type="number"
                step={0.1}
                min={0}
                max={5}
                className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                value={subtitleOutlineWidth}
                onChange={(e) => setSubtitleOutlineWidth(Number(e.target.value) || 1)}
              />
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_shadow_color', '阴影颜色 ASS')}</span>
              <input
                type="text"
                className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                value={subtitleShadowColor}
                onChange={(e) => setSubtitleShadowColor(e.target.value)}
                placeholder="&H80000000"
              />
            </label>
            <label className="flex items-center gap-[6px]">
              <input
                type="checkbox"
                className="h-[14px] w-[14px]"
                checked={subtitleNoBackground}
                onChange={(e) => setSubtitleNoBackground(e.target.checked)}
              />
              <span className="text-[12px]">{t('subtitle_no_background', '无背景')}</span>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_back_color', '背景颜色 ASS')}</span>
              <input
                type="text"
                className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                value={subtitleBackColor}
                onChange={(e) => setSubtitleBackColor(e.target.value)}
                placeholder="&H00000000"
              />
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_border_style', '边框样式 ASS')}</span>
              <input
                type="number"
                min={1}
                max={4}
                className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                value={subtitleBorderStyle}
                onChange={(e) => setSubtitleBorderStyle(Number(e.target.value) || 4)}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px]">
            <label className="flex flex-col gap-[4px]">
              <span>{t('script_languages', '脚本语言')}</span>
              <select
                multiple
                className="min-h-[60px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] py-[6px] text-[12px] outline-none"
                value={scriptLanguages}
                onChange={(e) => setScriptLanguages(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
                <option value="ja">日文</option>
              </select>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_languages', '字幕语言')}</span>
              <select
                multiple
                className="min-h-[60px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] py-[6px] text-[12px] outline-none"
                value={subtitleLanguages}
                onChange={(e) => setSubtitleLanguages(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
                <option value="ja">日文</option>
              </select>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('subtitle_languages_to_show', '显示字幕语言')}</span>
              <select
                multiple
                className="min-h-[60px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] py-[6px] text-[12px] outline-none"
                value={subtitleLanguagesToShow}
                onChange={(e) => setSubtitleLanguagesToShow(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
                <option value="ja">日文</option>
              </select>
            </label>
          </div>
          </>
          )}
        </div>
        </div>
      </CollapsibleSection>

      {/* 4. Prompt 版本选择 */}
      <CollapsibleSection title={t('prompt_versions', 'Prompt 版本选择')} icon="</>" defaultOpen={false}>
        <div className="flex flex-col gap-[12px]">
          {promptCoreNamesFiltered.map((name) => {
            const prompts = promptsGrouped[name] || [];
            const value = promptConfigs[name] ?? `default-${name}`;
            const hasCustom = !!(promptTemplates[name]?.trim());
            const effectiveValue = value === `custom-${name}` && !hasCustom ? `default-${name}` : value;
            return (
              <label key={name} className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{PROMPT_NAME_LABELS[name] || name}</span>
                <select
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={effectiveValue}
                  onChange={(e) => setPromptConfigs((prev) => ({ ...prev, [name]: e.target.value }))}
                  disabled={loadingPrompts}
                >
                  <option value={`default-${name}`}>{t('system_default', '系统默认')}</option>
                  <option value={`custom-${name}`}>{t('custom_template', '自定义模板')}</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version}
                      {p.variant ? ` (${p.variant})` : ''}
                      {p.is_default ? ' [默认]' : ''}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
        <button type="button" className="mt-[12px] flex items-center gap-[4px] text-[12px] text-textItemBlur hover:text-textColor" onClick={() => setShowExtendedPrompts((v) => !v)}>
          {showExtendedPrompts ? '▼' : '▶'} {t('extended_prompts', '扩展提示词')}
        </button>
        {showExtendedPrompts && (
          <div className="mt-[8px] grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
            {promptExtendedNamesFiltered.map((name) => {
              const prompts = promptsGrouped[name] || [];
              const value = promptConfigs[name] ?? `default-${name}`;
              return (
                <label key={name} className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{PROMPT_NAME_LABELS[name] || name}</span>
                  <select
                    className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                    value={value}
                    onChange={(e) => setPromptConfigs((prev) => ({ ...prev, [name]: e.target.value }))}
                    disabled={loadingPrompts}
                  >
                    <option value={`default-${name}`}>{t('system_default', '系统默认')}</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        v{p.version}
                        {p.variant ? ` (${p.variant})` : ''}
                        {p.is_default ? ' [默认]' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* 5. 扩展提示词 */}
      <CollapsibleSection title={t('extended_prompts', '扩展提示词')} icon="🧠" defaultOpen={false}>
        <div className="flex flex-col gap-[14px]">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-[500]">{t('account_advanced_prompt', '账号风格提示词')}</span>
            <textarea
              className="min-h-[88px] resize-none rounded-[8px] border border-input bg-newBgColorInner px-[10px] py-[8px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
              placeholder={t('short_video_prompt_placeholder', '你是一位面向 {{target_audience}} 的短视频创作者...')}
              value={defaultAdvancedPrompt}
              onChange={(e) => setDefaultAdvancedPrompt(e.target.value)}
            />
            <div className="text-[11px] text-textItemBlur">
              {t('prompt_variables', '可用变量')}: {'{{topic}}、{{platform}}、{{target_audience}}'}
            </div>
          </label>
          <div>
            <div className="text-[12px] font-[500] mb-[8px]">{t('core_prompts', '核心提示词')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              {promptCoreNamesFiltered.map((name) => (
                <label key={name} className="flex flex-col gap-[4px] rounded-[8px] border border-newBorder p-[12px] bg-newSettings/30">
                  <span className="text-[12px]">{PROMPT_NAME_LABELS[name] || name}</span>
                  <textarea
                    className="min-h-[56px] resize-none rounded-[8px] border border-input bg-newBgColorInner px-[8px] py-[6px] text-[12px] outline-none focus:ring-2 focus:ring-[#612BD3]/20"
                    placeholder={t('fill_prompt_placeholder', '留空使用系统默认')}
                    value={promptTemplates[name] ?? ''}
                    onChange={(e) => setPromptTemplates((prev) => ({ ...prev, [name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="flex items-center gap-[4px] text-[12px] text-textItemBlur hover:text-textColor" onClick={() => setExpandPromptTemplates((v) => !v)}>
            {expandPromptTemplates ? '▼' : '▶'} {t('extended_prompts', '扩展提示词')}
          </button>
          {expandPromptTemplates && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              {promptExtendedNamesFiltered.map((name) => (
                <label key={name} className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{PROMPT_NAME_LABELS[name] || name}</span>
                  <textarea
                    className="min-h-[52px] resize-none rounded-[8px] border border-input bg-newBgColorInner px-[8px] py-[6px] text-[12px] outline-none focus:ring-2 focus:ring-[#612BD3]/20"
                    placeholder={t('fill_prompt_placeholder', '留空使用系统默认')}
                    value={promptTemplates[name] ?? ''}
                    onChange={(e) => setPromptTemplates((prev) => ({ ...prev, [name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 6. AI 模型配置 */}
      <CollapsibleSection title={t('ai_model_config', 'AI 模型配置')} icon="⚡" defaultOpen={false}>
        <div className="flex flex-col gap-[12px]">
          <div className="grid grid-cols-2 gap-[10px]">
            <label className="flex flex-col gap-[4px]">
              <span>{t('llm_script', '脚本模型')}</span>
              <div className="flex gap-[4px]">
                <select className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelScriptProvider} onChange={(e) => setLlmModelScriptProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <input type="text" className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelScript} onChange={(e) => setLlmModelScript(e.target.value)} placeholder="gpt-4o-mini" />
              </div>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('llm_search_terms', '搜索关键词模型')}</span>
              <div className="flex gap-[4px]">
                <select className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelSearchTermsProvider} onChange={(e) => setLlmModelSearchTermsProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <input type="text" className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelSearchTerms} onChange={(e) => setLlmModelSearchTerms(e.target.value)} placeholder="gpt-4o-mini" />
              </div>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span>{t('llm_key_points', '关键点模型')}</span>
              <div className="flex gap-[4px]">
                <select className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelKeyPointsProvider} onChange={(e) => setLlmModelKeyPointsProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <input type="text" className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelKeyPoints} onChange={(e) => setLlmModelKeyPoints(e.target.value)} placeholder="gpt-4o-mini" />
              </div>
            </label>
            <label className="flex flex-col gap-[4px]">
              <span className="text-[12px]">{t('llm_keywords', '字幕关键词模型')}</span>
              <div className="flex gap-[4px]">
                <select className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelKeywordsProvider} onChange={(e) => setLlmModelKeywordsProvider(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <input type="text" className="flex-1 h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={llmModelKeywords} onChange={(e) => setLlmModelKeywords(e.target.value)} placeholder="gpt-4o-mini" />
              </div>
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {/* 7. 高级配置 */}
      <CollapsibleSection title={t('advanced_config', '高级配置')} icon="⚙️" defaultOpen={false}>
        <div className="flex flex-col gap-[12px]">
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-[600]">{t('video_synthesis_provider', '视频合成提供商')}</span>
            <select
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={composeProvider}
              onChange={(e) => setComposeProvider(e.target.value)}
              disabled={effectiveUseFreeVideos}
            >
              <option value="creatomate">Creatomate</option>
              <option value="ffmpeg">FFmpeg</option>
              <option value="remotion">Remotion</option>
              <option value="manim">Manim</option>
            </select>
          </label>
          {composeProvider === 'creatomate' && (
            <label className="flex flex-col gap-[4px]">
              <span className="text-[12px]">{t('creatomate_template_id', 'Creatomate 模板 ID')}</span>
              <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateTemplateId} onChange={(e) => setCreatomateTemplateId(e.target.value)} placeholder="输入模板 ID" />
            </label>
          )}
          {composeProvider === 'remotion' && (
            <>
              <label className="flex flex-col gap-[4px]"><span>{t('remotion_template_id', 'Remotion 模板 ID')}</span>
                <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={remotionTemplateId} onChange={(e) => setRemotionTemplateId(e.target.value)} placeholder="模板 ID" />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-[10px]">
                <label className="flex flex-col gap-[4px]"><span>{t('remotion_codec', '视频编码')}</span>
                  <select className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={remotionCodec} onChange={(e) => setRemotionCodec(e.target.value)}>
                    <option value="h264">H.264</option>
                    <option value="h265">H.265/HEVC</option>
                  </select>
                </label>
                <label className="flex flex-col gap-[4px]"><span>{t('remotion_quality', '渲染质量')}</span>
                  <input type="number" min={1} max={100} className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={remotionQuality} onChange={(e) => setRemotionQuality(Number(e.target.value) || 80)} />
                </label>
                <label className="flex flex-col gap-[4px]"><span>{t('fps', '帧率 FPS')}</span>
                  <input type="number" min={24} max={60} step={6} className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={fps} onChange={(e) => setFps(Number(e.target.value) || 30)} />
                </label>
              </div>
            </>
          )}
          {composeProvider === 'manim' && (
            <div className="text-[12px] text-textItemBlur">Manim 配置见下方</div>
          )}
        </div>
      </CollapsibleSection>

      {/* 8. 素材来源 */}
      <CollapsibleSection title={t('material_sources', '素材来源')} icon="📁" defaultOpen={false}>
        <div className="flex flex-col gap-[14px]">
          {!effectiveUseFreeVideos && (
            <div>
              <div className="text-[12px] text-textItemBlur mb-[8px]">{t('image_platforms', '图片平台')}</div>
              <div className="flex flex-wrap gap-[8px]">
                {['pexels', 'pixabay', 'unsplash'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (imagePlatforms.includes(p)) setImagePlatforms((prev) => prev.filter((x) => x !== p));
                      else setImagePlatforms((prev) => [...prev, p]);
                    }}
                    className={clsx(
                      'h-[32px] px-[14px] rounded-[8px] text-[12px] font-[500] capitalize transition-colors',
                      imagePlatforms.includes(p) ? 'bg-[#612BD3] text-white' : 'bg-newBorder/50 text-textItemBlur hover:text-white'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {effectiveUseFreeVideos && (
            <div>
              <div className="text-[12px] text-textItemBlur mb-[8px]">{t('video_platforms', '视频平台')}</div>
              <div className="flex flex-wrap gap-[8px]">
                {['pexels', 'pixabay'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (videoPlatforms.includes(p)) setVideoPlatforms((prev) => prev.filter((x) => x !== p));
                      else setVideoPlatforms((prev) => [...prev, p]);
                    }}
                    className={clsx(
                      'h-[32px] px-[14px] rounded-[8px] text-[12px] font-[500] capitalize transition-colors',
                      videoPlatforms.includes(p) ? 'bg-[#612BD3] text-white' : 'bg-newBorder/50 text-textItemBlur hover:text-white'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                  <label className="flex flex-col gap-[4px]">
                    <span className="text-[12px]">{t('subtitle_source_language', '字幕源语言')}</span>
                    <select className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={subtitleSourceLanguage} onChange={(e) => setSubtitleSourceLanguage(e.target.value)}>
                      <option value="zh">中文</option>
                      <option value="en">英文</option>
                      <option value="ja">日文</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-[4px]">
                    <span className="text-[12px]">{t('script_source_language', '脚本源语言')}</span>
                    <select className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={scriptSourceLanguage} onChange={(e) => setScriptSourceLanguage(e.target.value)}>
                      <option value="zh">中文</option>
                      <option value="en">英文</option>
                      <option value="ja">日文</option>
                    </select>
                  </label>
                </div>
                {composeProvider === 'creatomate' && (
                  <div className={clsx('grid gap-[10px]', !effectiveUseFreeVideos ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
                    {!effectiveUseFreeVideos && (
                      <label className="flex flex-col gap-[4px]">
                        <span className="text-[12px]">{t('creatomate_image_prefix', '图片元素前缀')}</span>
                        <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateImagePrefix} onChange={(e) => setCreatomateImagePrefix(e.target.value)} placeholder="Image" />
                      </label>
                    )}
                    <label className="flex flex-col gap-[4px]">
                      <span className="text-[12px]">{t('creatomate_audio_element', '音频元素名')}</span>
                      <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateAudioElement} onChange={(e) => setCreatomateAudioElement(e.target.value)} placeholder="Audio-1" />
                    </label>
                    <label className="flex flex-col gap-[4px]">
                      <span className="text-[12px]">{t('creatomate_subtitle_element', '字幕元素名')}</span>
                      <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateSubtitleElement} onChange={(e) => setCreatomateSubtitleElement(e.target.value)} placeholder="Subtitle-1" />
                    </label>
                  </div>
                )}
              </div>
            {/* 音视频参数 - 保留在素材来源内 */}
            <div className="pt-[12px] border-t border-newBorder">
              <div className="text-[12px] font-[500] mb-[8px]">{t('av_params', '音视频参数')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <label className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{t('creatomate_audio_element', '音频元素名')}</span>
                  <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateAudioElement} onChange={(e) => setCreatomateAudioElement(e.target.value)} placeholder="Audio-1" />
                </label>
                <label className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{t('creatomate_subtitle_element', '字幕元素名')}</span>
                  <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={creatomateSubtitleElement} onChange={(e) => setCreatomateSubtitleElement(e.target.value)} placeholder="Subtitle-1" />
                </label>
                <label className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{t('audio_bitrate', '音频比特率')}</span>
                  <input type="text" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)} placeholder="192k" />
                </label>
                <label className="flex flex-col gap-[4px]">
                  <span className="text-[12px]">{t('audio_sample_rate', '音频采样率 (Hz)')}</span>
                  <input type="number" className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none" value={audioSampleRate} onChange={(e) => setAudioSampleRate(Number(e.target.value) || 44100)} />
                </label>
              </div>
            </div>
            <div className="pt-[12px] mt-[12px] border-t border-newBorder">
              <div className="text-[12px] font-[500] mb-[8px]">{t('search_options', '搜索选项')}</div>
              <div className="flex flex-col gap-[10px]">
                <ToggleSwitch label={t('enable_search_expansion', '启用搜索词扩展')} checked={enableSearchExpansion} onChange={setEnableSearchExpansion} />
                {effectiveUseFreeVideos && (
                  <ToggleSwitch label={t('filter_animated_videos', '过滤动画风格视频')} checked={filterAnimatedVideos} onChange={setFilterAnimatedVideos} />
                )}
                <ToggleSwitch label={t('cascade_core_keyword_first', '核心词优先级联搜索')} checked={cascadeCoreKeywordFirst} onChange={setCascadeCoreKeywordFirst} />
              </div>
            </div>
      </CollapsibleSection>

      {/* 9. 素材搜索参数 */}
      <CollapsibleSection title={t('material_search_params', '素材搜索参数')} icon="📦" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[24px] gap-y-[14px]">
          {!effectiveUseFreeVideos && (
            <>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('min_image_score', '最小图片评分')}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={minImageScore}
                  onChange={(e) => setMinImageScore(Number(e.target.value) || 70)}
                />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('images_per_platform', '每关键词每平台图片数')}</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={imagesPerPlatform}
                  onChange={(e) => setImagesPerPlatform(Number(e.target.value) || 5)}
                />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('cascade_min_images_per_subtitle', '级联时每字幕最少素材数')}</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={cascadeMinImagesPerSubtitle}
                  onChange={(e) => setCascadeMinImagesPerSubtitle(Number(e.target.value) || 3)}
                />
              </label>
            </>
          )}
          {effectiveUseFreeVideos && (
            <>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('min_video_score', '最小视频评分')}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={minVideoScore}
                  onChange={(e) => setMinVideoScore(Number(e.target.value) || 75)}
                />
              </label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[12px]">{t('videos_per_platform', '每关键词每平台视频数')}</span>
                <input
                  type="number"
                  min={50}
                  max={500}
                  step={10}
                  className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
                  value={videosPerPlatform}
                  onChange={(e) => setVideosPerPlatform(Number(e.target.value) || 300)}
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('keyword_search_max_per_subtitle', '每字幕检索关键词上限')}</span>
            <input
              type="number"
              min={1}
              max={15}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={keywordSearchMaxPerSubtitle}
              onChange={(e) => setKeywordSearchMaxPerSubtitle(Number(e.target.value) || 8)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('first_keyword_multiplier', '第一条关键词检索量倍率')}</span>
            <input
              type="number"
              min={1}
              max={3}
              step={0.1}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={firstKeywordMultiplier}
              onChange={(e) => setFirstKeywordMultiplier(Number(e.target.value) || 1.0)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('allocation_core_keyword_bonus', '分配时核心词加分')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={allocationCoreKeywordBonus}
              onChange={(e) => setAllocationCoreKeywordBonus(Number(e.target.value) || 0.2)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('keyword_min_per_subtitle', '每条字幕关键词最少条数')}</span>
            <input
              type="number"
              min={1}
              max={20}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={keywordMinPerSubtitle}
              onChange={(e) => setKeywordMinPerSubtitle(Number(e.target.value) || 5)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('keyword_max_per_subtitle', '每条字幕关键词最多条数')}</span>
            <input
              type="number"
              min={1}
              max={15}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={keywordMaxPerSubtitle}
              onChange={(e) => setKeywordMaxPerSubtitle(Number(e.target.value) || 8)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('filter_core_keyword_bonus_ratio', '筛选时核心词加分比例')}</span>
            <input
              type="number"
              min={0}
              max={0.5}
              step={0.01}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={filterCoreKeywordBonusRatio}
              onChange={(e) => setFilterCoreKeywordBonusRatio(Number(e.target.value) || 0.05)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('filter_relevance_weight', '筛选·主题相关性权重')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={filterRelevanceWeight}
              onChange={(e) => setFilterRelevanceWeight(Number(e.target.value) || 0.6)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('filter_subtitle_relevance_weight', '筛选·字幕关键词权重')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={filterSubtitleRelevanceWeight}
              onChange={(e) => setFilterSubtitleRelevanceWeight(Number(e.target.value) || 0.4)}
            />
          </label>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[12px]">{t('filter_base_score_weight', '筛选·基础分权重')}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-[32px] rounded-[8px] border border-input bg-newBgColorInner px-[8px] text-[12px] outline-none"
              value={filterBaseScoreWeight}
              onChange={(e) => setFilterBaseScoreWeight(Number(e.target.value) || 0.6)}
            />
          </label>
        </div>
      </CollapsibleSection>

      {/* 10. 图片匹配评分权重 - 仅图片模式 */}
      {!effectiveUseFreeVideos && (
      <CollapsibleSection
        title={t('image_match_weights', '图片匹配评分权重')}
        icon="🖼️"
        defaultOpen={false}
      >
        <div className="flex flex-col gap-[14px]">
          <ToggleSwitch
            label={t('use_semantic_matching', '启用语义相似度匹配')}
            checked={useSemanticMatching}
            onChange={setUseSemanticMatching}
          />
          <div className="flex flex-col gap-[12px]">
            <WeightSlider label={t('match_weight_base_score', '基础分权重')} value={matchWeightBaseScore} onChange={(v) => setMatchWeightBaseScore(v)} />
            <WeightSlider label={t('match_weight_keyword', '关键词匹配权重')} value={matchWeightKeyword} onChange={(v) => setMatchWeightKeyword(v)} />
            <WeightSlider label={t('match_weight_subtitle_text', '字幕文本匹配权重')} value={matchWeightSubtitleText} onChange={(v) => setMatchWeightSubtitleText(v)} />
            <WeightSlider label={t('match_weight_duration', '时长匹配权重')} value={matchWeightDuration} onChange={(v) => setMatchWeightDuration(v)} />
            <WeightSlider label={t('match_weight_semantic', '语义相似度权重')} value={matchWeightSemantic} onChange={(v) => setMatchWeightSemantic(v)} />
            <WeightSlider label={t('match_weight_relevance', '相关性评分权重')} value={matchWeightRelevance} onChange={(v) => setMatchWeightRelevance(v)} />
          </div>
        </div>
      </CollapsibleSection>
      )}

      {/* 11. 视频匹配评分权重 - 仅视频模式 */}
      {effectiveUseFreeVideos && (
      <CollapsibleSection
        title={t('video_match_weights', '视频匹配评分权重')}
        icon="🎬"
        defaultOpen={false}
      >
        <div className="flex flex-col gap-[14px]">
          <ToggleSwitch
            label={t('use_semantic_matching', '启用语义相似度匹配')}
            checked={useSemanticMatching}
            onChange={setUseSemanticMatching}
          />
          <div className="flex flex-col gap-[12px]">
            <WeightSlider
              label={t('match_weight_base_score', '基础分权重')}
              value={matchWeightBaseScore}
              onChange={(v) => setMatchWeightBaseScore(v)}
            />
            <WeightSlider
              label={t('match_weight_keyword', '关键词匹配权重')}
              value={matchWeightKeyword}
              onChange={(v) => setMatchWeightKeyword(v)}
            />
            <WeightSlider
              label={t('match_weight_subtitle_text', '字幕文本匹配权重')}
              value={matchWeightSubtitleText}
              onChange={(v) => setMatchWeightSubtitleText(v)}
            />
            <WeightSlider
              label={t('match_weight_duration', '时长匹配权重')}
              value={matchWeightDuration}
              onChange={(v) => setMatchWeightDuration(v)}
            />
            <WeightSlider
              label={t('match_weight_semantic', '语义相似度权重')}
              value={matchWeightSemantic}
              onChange={(v) => setMatchWeightSemantic(v)}
            />
            <WeightSlider
              label={t('match_weight_relevance', '相关性评分权重')}
              value={matchWeightRelevance}
              onChange={(v) => setMatchWeightRelevance(v)}
            />
          </div>
        </div>
      </CollapsibleSection>
      )}
    </form>
  );
});
