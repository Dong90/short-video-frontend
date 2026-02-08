'use client';

import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import clsx from 'clsx';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

type ShortVideoTaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface ShortVideoTask {
  id: string;
  integrationId: string;
  integrationName: string;
  platformIdentifier: string;
  status: ShortVideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
}

// 与 short_video 对齐
type DurationOverride = 'account' | '15' | '30' | '60' | '90';
type ToneOverride = 'account' | 'professional' | 'casual' | 'funny' | 'authoritative' | 'serious' | 'educational';
type ContentTypeVal = 'account' | 'knowledge' | 'book_review' | 'educational' | 'trend_analysis';
type AspectRatioVal = 'account' | '9:16' | '16:9' | '1:1' | '4:3';
type ContentStyleVal = 'account' | 'explain' | 'vlog' | 'listicle' | 'story';
type ScriptStyleVal = 'account' | 'tutorial' | 'chat' | 'humor' | 'authority';
type SubtitlePresetVal = 'account' | 'default' | 'highlight' | 'minimal';

export const ShortVideoTasksPanel: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();

  const {
    selectedIntegrations,
    current,
    global,
    internal,
    appendGlobalValueMedia,
    appendInternalValueMedia,
    setGlobalValue,
    setInternalValue,
  } = useLaunchStore(
    useShallow((state) => ({
      selectedIntegrations: state.selectedIntegrations,
      current: state.current,
      global: state.global,
      internal: state.internal,
      appendGlobalValueMedia: state.appendGlobalValueMedia,
      appendInternalValueMedia: state.appendInternalValueMedia,
      setGlobalValue: state.setGlobalValue,
      setInternalValue: state.setInternalValue,
    }))
  );

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [durationOverride, setDurationOverride] =
    useState<DurationOverride>('account');
  const [toneOverride, setToneOverride] =
    useState<ToneOverride>('account');
  const [idea, setIdea] = useState('');
  const [hint, setHint] = useState('');
  const [personaId, setPersonaId] = useState<string>('');
  const [platformAccountId, setPlatformAccountId] = useState<string>('');
  const [contentType, setContentType] = useState<ContentTypeVal>('account');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioVal>('account');
  const [contentStyle, setContentStyle] = useState<ContentStyleVal>('account');
  const [scriptStyle, setScriptStyle] = useState<ScriptStyleVal>('account');
  const [overridePrompt, setOverridePrompt] = useState('');
  const [imageCount, setImageCount] = useState<string>(''); // 空=沿用账号
  const [audience, setAudience] = useState('');
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePresetVal>('account');
  const [environmentPrompt, setEnvironmentPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string }>>([]);
  const [platformAccounts, setPlatformAccounts] = useState<Array<{ id: string; name: string; platform: string }>>([]);
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, unknown>>({});
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [bookVideoContentMode, setBookVideoContentMode] = useState<'db' | 'rsshub' | 'external'>('db');
  // 选题逻辑：short_video 与 book_video 共用
  const [topicMode, setTopicMode] = useState<'auto_topic' | 'manual_topic'>('auto_topic');
  const [topicText, setTopicText] = useState('');
  const [bookVideoCategory, setBookVideoCategory] = useState('');
  const [bookVideoSourceTags, setBookVideoSourceTags] = useState<string[]>([]);
  const [bookVideoBookIds, setBookVideoBookIds] = useState<string[]>([]);
  const [bookVideoRsshubUrl, setBookVideoRsshubUrl] = useState('');
  const [bookCategories, setBookCategories] = useState<string[]>([]);
  const [bookSourceTags, setBookSourceTags] = useState<string[]>([]);
  const [booksForSelection, setBooksForSelection] = useState<Array<{ id: string; title: string; author: string }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [tasks, setTasks] = useState<ShortVideoTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化 / 当选择的账号变化时重置勾选
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    selectedIntegrations.forEach((item) => {
      initial[item.integration.id] = true;
    });
    setSelectedIds(initial);
  }, [selectedIntegrations]);

  // 加载人设和平台账号（用于传递给 short_video）
  useEffect(() => {
    let cancelled = false;
    setLoadingPersonas(true);
    fetch('/short-video/personas?status=active&limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          const i = d?.items ?? [];
          setPersonas(Array.isArray(i) ? i.map((p: any) => ({ id: p.id, name: p.name || p.id })) : []);
        }
      })
      .finally(() => { if (!cancelled) setLoadingPersonas(false); });
    return () => { cancelled = true; };
  }, [fetch]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAccounts(true);
    fetch('/short-video/platform-accounts?status=active&limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          const i = d?.items ?? [];
          setPlatformAccounts(Array.isArray(i) ? i.map((a: any) => ({ id: a.id, name: a.name, platform: a.platform || '' })) : []);
        }
      })
      .finally(() => { if (!cancelled) setLoadingAccounts(false); });
    return () => { cancelled = true; };
  }, [fetch]);

  useEffect(() => {
    let cancelled = false;
    fetch('/short-video/integration-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d === 'object') setIntegrationConfig(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetch]);

  const workflowType = (integrationConfig as Record<string, unknown>)?.workflow_type as string || 'short_video';
  const isBookVideo = workflowType === 'book_video';

  useEffect(() => {
    if (!isBookVideo) return;
    let cancelled = false;
    fetch('/short-video/book-catalog/categories')
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setBookCategories(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetch, isBookVideo]);

  useEffect(() => {
    if (!isBookVideo || !bookVideoCategory) return;
    let cancelled = false;
    fetch(`/short-video/book-catalog/source-tags?category=${encodeURIComponent(bookVideoCategory)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setBookSourceTags(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetch, isBookVideo, bookVideoCategory]);

  useEffect(() => {
    if (!isBookVideo || !bookVideoCategory) return;
    let cancelled = false;
    const params = new URLSearchParams({ category: bookVideoCategory, limit: '50' });
    if (bookVideoSourceTags.length > 0) params.set('source_tags', bookVideoSourceTags.join(','));
    fetch(`/short-video/book-catalog/books/for-selection?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setBooksForSelection(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetch, isBookVideo, bookVideoCategory, bookVideoSourceTags]);

  const hasSelectableIntegrations = selectedIntegrations.length > 0;

  const toggleIntegration = useCallback((id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const selectedForTask = useMemo(
    () =>
      selectedIntegrations.filter(
        (item) => selectedIds[item.integration.id]
      ),
    [selectedIntegrations, selectedIds]
  );

  const createTasks = useCallback(async () => {
    if (!selectedForTask.length) {
      toaster.show(
        t(
          'short_video_select_at_least_one_account',
          'Please select at least one account for short video.'
        ),
        'warning'
      );
      return;
    }
    const cfg = integrationConfig as Record<string, unknown>;
    const workflowTypeFromCfg = (cfg?.workflow_type as string) || 'short_video';
    const isBookVideo = workflowTypeFromCfg === 'book_video';
    // 选题逻辑：manual_topic 需填选题主题或创意内容；auto_topic 可留空
    if (!isBookVideo) {
      if (topicMode === 'manual_topic' && !topicText?.trim() && !idea?.trim()) {
        toaster.show(t('short_video_topic_required', '手动选题时请填写选题主题或创意内容'), 'warning');
        return;
      }
    }

    setCreating(true);
    setError(null);

    // short_video: idea = topicText (manual) 或 idea (创意) 或空 (auto)
    const effectiveIdea = isBookVideo
      ? (idea?.trim() || '')
      : topicMode === 'manual_topic'
        ? (topicText?.trim() || idea?.trim() || '')
        : (idea?.trim() || '');

    // 构建任务创建请求（与 short-video CreateV2.tsx 对齐）
    // 注意：short-video 前端要求必须提供 workflow_type 或 target_platform+content_type
    const taskData: Record<string, unknown> = {
      idea: effectiveIdea || (workflowTypeFromCfg === 'book_video' ? '' : undefined),
      environment_prompt: environmentPrompt?.trim() || undefined,
      persona_id: personaId || (cfg?.persona_id as string) || undefined,
      workflow_type: (cfg?.workflow_type as string) || 'short_video',
      platform_account_id: platformAccountId || undefined,
    };
    
    // target_platform：从选中的 integrations 中获取（与 short-video CreateV2.tsx 第1231行对齐）
    // 注意：如果选择了多个不同 platform 的 integrations，这里只设置第一个
    // 后端应该会为每个 integration 使用其对应的 platform
    if (selectedForTask.length > 0) {
      const firstIntegration = selectedForTask[0]?.integration;
      if (firstIntegration?.identifier) {
        taskData.target_platform = firstIntegration.identifier;
      }
    }
    
    // 选题逻辑：short_video 与 book_video 统一传递
    if (topicMode === 'manual_topic' && topicText?.trim()) {
      taskData.topic_mode = 'manual_topic';
      taskData.topic_text = topicText.trim();
    } else {
      taskData.topic_mode = 'auto_topic';
    }
    
    // content_type（如果设置了且不为 'account'）
    if (contentType !== 'account') {
      taskData.content_type = contentType;
    }
    
    // 任务级别配置覆盖（config 字段）
    const taskConfig: Record<string, unknown> = {};
    if (durationOverride !== 'account') {
      taskConfig.video_duration = Number(durationOverride);
    }
    if (imageCount) {
      taskConfig.image_count = Number(imageCount);
    }
    if (aspectRatio !== 'account') {
      taskConfig.video_aspect_ratio = aspectRatio;
    }
    if (Object.keys(taskConfig).length > 0) {
      taskData.config = taskConfig;
    }

    if (isBookVideo) {
      if (bookVideoContentMode === 'db') {
        if (!bookVideoCategory) {
          toaster.show(t('book_video_category_required', '请选择书籍大类'), 'warning');
          setCreating(false);
          return;
        }
        taskData.content_source = {
          material_type: 'book',
          provider: 'db',
          selector: {
            category: bookVideoCategory,
            source_tags: bookVideoSourceTags,
            ...(bookVideoBookIds.length > 0 ? { book_ids: bookVideoBookIds } : {}),
          },
        };
      } else if (bookVideoContentMode === 'rsshub') {
        if (!bookVideoRsshubUrl?.trim()) {
          toaster.show(t('book_video_rsshub_required', '请填写 RSSHub 地址'), 'warning');
          setCreating(false);
          return;
        }
        taskData.content_source = {
          material_type: 'article',
          provider: 'rsshub',
          selector: { url: bookVideoRsshubUrl.trim() },
        };
      }
      taskData.idea = idea?.trim() || '';
      // book_video 必须显式传 use_free_videos
      if (!taskData.config) taskData.config = {};
      (taskData.config as Record<string, unknown>).use_free_videos = cfg?.use_free_videos !== undefined ? !!cfg.use_free_videos : true;
    }
    
    const body = {
      integrations: selectedForTask.map((item) => ({
        integrationId: item.integration.id,
        platform: item.integration.identifier,
      })),
      overrides: taskData,
    };

    try {
      const res = await fetch('/short-video/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let newTasks: ShortVideoTask[] = selectedForTask.map((item) => ({
        id: makeId(12),
        integrationId: item.integration.id,
        integrationName: item.integration.name,
        platformIdentifier: item.integration.identifier,
        status: 'queued',
      }));

      if (res.ok) {
        // 尝试从后端返回中读取任务信息（如果已有）
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.tasks)) {
          newTasks = data.tasks.map((task: any) => ({
            id: task.id || makeId(12),
            integrationId: task.integrationId,
            integrationName:
              selectedForTask.find(
                (i) =>
                  i.integration.id === task.integrationId
              )?.integration.name || '',
            platformIdentifier:
              selectedForTask.find(
                (i) =>
                  i.integration.id === task.integrationId
              )?.integration.identifier || '',
            status: (task.status ||
              'queued') as ShortVideoTaskStatus,
            videoUrl: task.videoUrl,
          }));
        }
      } else {
        const text = await res.text();
        setError(
          text ||
            t(
              'short_video_task_creation_failed',
              'Failed to create short video tasks.'
            )
        );
      }

      setTasks((prev) => [...prev, ...newTasks]);
      toaster.show(
        t(
          'short_video_task_created',
          'Short video tasks created.'
        ),
        'success'
      );
    } catch (e) {
      setError(
        t(
          'short_video_task_creation_failed',
          'Failed to create short video tasks.'
        )
      );
    } finally {
      setCreating(false);
    }
  }, [
    selectedForTask,
    idea,
    durationOverride,
    toneOverride,
    hint,
    personaId,
    platformAccountId,
    contentType,
    aspectRatio,
    contentStyle,
    scriptStyle,
    overridePrompt,
    imageCount,
    audience,
    subtitlePreset,
    environmentPrompt,
    integrationConfig,
    bookVideoContentMode,
    topicMode,
    topicText,
    bookVideoCategory,
    bookVideoSourceTags,
    bookVideoBookIds,
    bookVideoRsshubUrl,
    fetch,
    toaster,
    t,
  ]);

  const handlePreview = useCallback((task: ShortVideoTask) => {
    if (!task.videoUrl) {
      toaster.show(
        t(
          'short_video_no_preview_yet',
          'Preview is not available yet for this task.'
        ),
        'warning'
      );
      return;
    }
    window.open(task.videoUrl, '_blank');
  }, [toaster, t]);

  const handleInsertToPost = useCallback(
    async (task: ShortVideoTask) => {
      if (!task.videoUrl) {
        toaster.show(
          t(
            'short_video_no_video_url',
            'Video URL is not available yet for this task.'
          ),
          'warning'
        );
        return;
      }

      try {
        const res = await fetch('/public/v1/upload-from-url', {
          method: 'POST',
          body: JSON.stringify({
            url: task.videoUrl,
          }),
        });

        if (!res.ok) {
          toaster.show(
            t(
              'short_video_insert_failed',
              'Failed to insert video into the current post.'
            ),
            'warning'
          );
          return;
        }

        const uploaded = await res.json();
        const media = {
          id: uploaded.id,
          path: uploaded.path,
        };

        // 将媒体追加到当前帖子
        if (current === 'global') {
          if (global.length === 0) {
            setGlobalValue([
              {
                id: makeId(10),
                content: '',
                delay: 0,
                media: [media],
              },
            ]);
          } else {
            appendGlobalValueMedia(0, [media]);
          }
        } else {
          const internalItem = internal.find(
            (i) => i.integration.id === current
          );
          if (!internalItem) {
            // 如果当前 integration 还没有内部值，则创建一个
            setInternalValue(current, [
              {
                id: makeId(10),
                content: '',
                delay: 0,
                media: [media],
              },
            ]);
          } else if (internalItem.integrationValue.length === 0) {
            setInternalValue(current, [
              {
                id: makeId(10),
                content: '',
                delay: 0,
                media: [media],
              },
            ]);
          } else {
            appendInternalValueMedia(current, 0, [media]);
          }
        }

        toaster.show(
          t(
            'short_video_inserted_to_post',
            'Video inserted into the current post.'
          ),
          'success'
        );
      } catch (e) {
        toaster.show(
          t(
            'short_video_insert_failed',
            'Failed to insert video into the current post.'
          ),
          'warning'
        );
      }
    },
    [
      current,
      global,
      internal,
      appendGlobalValueMedia,
      appendInternalValueMedia,
      setGlobalValue,
      setInternalValue,
      fetch,
      toaster,
      t,
    ]
  );

  // 轮询任务状态（只针对 queued / processing）
  useEffect(() => {
    const activeTasks = tasks.filter(
      (task) =>
        task.status === 'queued' || task.status === 'processing'
    );

    if (!activeTasks.length) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const updates = await Promise.all(
          activeTasks.map(async (task) => {
            try {
              const res = await fetch(
                `/short-video/tasks/${encodeURIComponent(task.id)}`,
                {
                  method: 'GET',
                }
              );

              if (!res.ok) {
                return null;
              }

              const data = await res.json();
              return {
                id: task.id,
                status: (data.status ||
                  task.status) as ShortVideoTaskStatus,
                videoUrl: data.videoUrl || task.videoUrl,
              };
            } catch {
              return null;
            }
          })
        );

        if (cancelled) {
          return;
        }

        setTasks((prev) =>
          prev.map((task) => {
            const update = updates.find(
              (u) => u && u.id === task.id
            );
            if (!update) {
              return task;
            }
            return {
              ...task,
              status: update.status,
              videoUrl: update.videoUrl,
            };
          })
        );
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 5000);
    // 立即先 poll 一次，避免多等 5 秒
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tasks, fetch]);

  if (!hasSelectableIntegrations) {
    return null;
  }

  return (
    <div className="mt-[20px] flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <div className="text-[14px] font-[600]">
          {t('ai_short_video', 'AI 短视频')}
        </div>
        <div className="text-[12px] text-textItemBlur">
          {t(
            'ai_short_video_description',
            'Create short video tasks for this launch. By default, settings from each account will be used.'
          )}
        </div>
      </div>

      {/* 目标账号 */}
      <div className="flex flex-col gap-[8px]">
        <div className="text-[13px] font-[600]">
          {t('target_accounts', '目标账号')}
        </div>
        <div className="flex flex-col gap-[6px]">
          {selectedIntegrations.map((item) => {
            const integration = item.integration;
            const checked = !!selectedIds[integration.id];

            // 账号描述（未来可从 shortVideoConfig 中读取）
            const description = `${integration.identifier}`;

            return (
              <button
                key={integration.id}
                type="button"
                onClick={() => toggleIntegration(integration.id)}
                className={clsx(
                  'flex w-full items-center gap-[8px] rounded-[8px] border px-[8px] py-[6px] text-left',
                  checked
                    ? 'border-primary bg-primary/10'
                    : 'border-newBorder bg-newSettings'
                )}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={checked}
                  className="h-[14px] w-[14px] accent-primary"
                />
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center gap-[6px]">
                    <span className="truncate text-[13px] font-[500]">
                      {integration.name}
                    </span>
                    <span className="rounded-[4px] bg-newBgColor px-[4px] py-[1px] text-[10px] text-textItemBlur">
                      {integration.identifier}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-textItemBlur">
                    {description}
                  </div>
                </div>
                <div className="flex h-[20px] w-[20px] items-center justify-center overflow-hidden rounded-full bg-newBgColor">
                  <img
                    src={`/icons/platforms/${integration.identifier}.png`}
                    alt={integration.identifier}
                    className="h-[16px] w-[16px] object-contain"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 本次任务设置 - 参考 short_video CreateV2：主区域简洁，可选覆盖收折叠 */}
      <div className="flex flex-col gap-[8px] rounded-[8px] border border-newBorder bg-newSettings p-[10px]">
        <div className="text-[13px] font-[600]">
          {t('short_video_task_settings', '任务设置')}
        </div>
        <div className="text-[11px] text-textItemBlur">
          {t(
            'short_video_task_settings_desc',
            '选择平台账号可继承其配置；下方可选择性覆盖部分参数。'
          )}
        </div>

        <div className="mt-[4px] flex flex-col gap-[6px]">
          {/* 主区域：与 short_video CreateV2 对齐 */}
          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>
              {t('idea', '创意内容')}
              {!isBookVideo && topicMode === 'manual_topic' && <span className="text-[#F97066]"> *</span>}
            </span>
            <input
              type="text"
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              placeholder={
                isBookVideo
                  ? t('book_video_idea_optional', '可选，留空则自动选题')
                  : topicMode === 'auto_topic'
                    ? t('short_video_idea_optional', '可选，留空则自动选题')
                    : t('short_video_idea_placeholder', '例如：如何提高工作效率')
              }
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
          </label>

          {/* short_video 选题：与 book_video 完全对齐 */}
          {!isBookVideo && (
            <div className="flex flex-col gap-[8px] rounded-[6px] border border-newBorder bg-newBgColorInner p-[8px]">
              <label className="flex flex-col gap-[4px] text-[12px]">
                <span>{t('topic_mode', '选题模式')}</span>
                <div className="flex gap-[8px]">
                  <label className="flex items-center gap-[4px]">
                    <input
                      type="radio"
                      name="shortVideoTopicMode"
                      checked={topicMode === 'auto_topic'}
                      onChange={() => setTopicMode('auto_topic')}
                    />
                    <span>{t('auto_topic', '自动选题')}</span>
                  </label>
                  <label className="flex items-center gap-[4px]">
                    <input
                      type="radio"
                      name="shortVideoTopicMode"
                      checked={topicMode === 'manual_topic'}
                      onChange={() => setTopicMode('manual_topic')}
                    />
                    <span>{t('manual_topic', '手动选题')}</span>
                  </label>
                </div>
              </label>
              {topicMode === 'manual_topic' && (
                <label className="flex flex-col gap-[4px] text-[12px]">
                  <span>{t('topic_text', '选题主题')}</span>
                  <input
                    type="text"
                    className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
                    placeholder={t('topic_text_placeholder', '例如：如何度过中年焦虑')}
                    value={topicText}
                    onChange={(e) => setTopicText(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          {/* book_video 专属：内容来源、选题、选书 */}
          {isBookVideo && (
            <div className="flex flex-col gap-[8px] rounded-[6px] border border-newBorder bg-newBgColorInner p-[8px]">
              <div className="text-[12px] font-[600]">{t('book_video_content_source', '内容来源')}</div>
              <div className="flex gap-[8px]">
                {(['db', 'rsshub', 'external'] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-[4px] text-[12px]">
                    <input
                      type="radio"
                      name="bookVideoContentMode"
                      checked={bookVideoContentMode === mode}
                      onChange={() => setBookVideoContentMode(mode)}
                    />
                    <span>
                      {mode === 'db' ? t('book_video_db', '本地书库') : mode === 'rsshub' ? t('book_video_rsshub', 'RSSHub') : t('book_video_external', '外部内容')}
                    </span>
                  </label>
                ))}
              </div>
              {bookVideoContentMode === 'rsshub' && (
                <label className="flex flex-col gap-[4px] text-[12px]">
                  <span>{t('rsshub_url', 'RSSHub 地址')}</span>
                  <input
                    type="text"
                    className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
                    placeholder="/zhihu/hotlist 或完整 URL"
                    value={bookVideoRsshubUrl}
                    onChange={(e) => setBookVideoRsshubUrl(e.target.value)}
                  />
                </label>
              )}
              {bookVideoContentMode === 'db' && (
                <>
                  <label className="flex flex-col gap-[4px] text-[12px]">
                    <span>{t('book_category', '书籍大类')} <span className="text-[#F97066]">*</span></span>
                    <select
                      className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
                      value={bookVideoCategory}
                      onChange={(e) => {
                        setBookVideoCategory(e.target.value);
                        setBookVideoSourceTags([]);
                        setBookVideoBookIds([]);
                      }}
                    >
                      <option value="">{t('select', '请选择')}</option>
                      {bookCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  {bookVideoCategory && bookSourceTags.length > 0 && (
                    <label className="flex flex-col gap-[4px] text-[12px]">
                      <span>{t('source_tags', '小类标签')}</span>
                      <div className="flex flex-wrap gap-[6px]">
                        {bookSourceTags.map((tag) => (
                          <label key={tag} className="flex items-center gap-[2px] text-[11px]">
                            <input
                              type="checkbox"
                              checked={bookVideoSourceTags.includes(tag)}
                              onChange={(e) => {
                                if (e.target.checked) setBookVideoSourceTags((p) => [...p, tag]);
                                else setBookVideoSourceTags((p) => p.filter((x) => x !== tag));
                              }}
                            />
                            <span>{tag}</span>
                          </label>
                        ))}
                      </div>
                    </label>
                  )}
                  <label className="flex flex-col gap-[4px] text-[12px]">
                    <span>{t('topic_mode', '选题模式')}</span>
                    <div className="flex gap-[8px]">
                      <label className="flex items-center gap-[4px]">
                        <input
                          type="radio"
                          name="bookVideoTopicMode"
                          checked={topicMode === 'auto_topic'}
                          onChange={() => setTopicMode('auto_topic')}
                        />
                        <span>{t('auto_topic', '自动选题')}</span>
                      </label>
                      <label className="flex items-center gap-[4px]">
                        <input
                          type="radio"
                          name="bookVideoTopicMode"
                          checked={topicMode === 'manual_topic'}
                          onChange={() => setTopicMode('manual_topic')}
                        />
                        <span>{t('manual_topic', '手动选题')}</span>
                      </label>
                    </div>
                  </label>
                  {topicMode === 'manual_topic' && (
                    <label className="flex flex-col gap-[4px] text-[12px]">
                      <span>{t('topic_text', '选题主题')}</span>
                      <input
                        type="text"
                        className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
                        placeholder={t('topic_text_placeholder', '例如：如何度过中年焦虑')}
                        value={topicText}
                        onChange={(e) => setTopicText(e.target.value)}
                      />
                    </label>
                  )}
                  {booksForSelection.length > 0 && (
                    <label className="flex flex-col gap-[4px] text-[12px]">
                      <span>{t('select_books', '选书（可选，不选则自动）')}</span>
                      <div className="max-h-[120px] overflow-y-auto rounded-[6px] border border-input bg-newBgColorInner p-[6px]">
                        {booksForSelection.slice(0, 20).map((b) => (
                          <label key={b.id} className="flex items-center gap-[4px] py-[2px] text-[11px]">
                            <input
                              type="checkbox"
                              checked={bookVideoBookIds.includes(b.id)}
                              onChange={(e) => {
                                if (e.target.checked) setBookVideoBookIds((p) => [...p, b.id]);
                                else setBookVideoBookIds((p) => p.filter((x) => x !== b.id));
                              }}
                            />
                            <span className="truncate">{b.title} - {b.author}</span>
                          </label>
                        ))}
                      </div>
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('platform_account', '平台账号')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={platformAccountId}
              onChange={(e) => setPlatformAccountId(e.target.value)}
              disabled={loadingAccounts}
            >
              <option value="">{t('short_video_select_platform_account', '选择以继承配置（可选）')}</option>
              {platformAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('persona', '人设')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              disabled={loadingPersonas}
            >
              <option value="">{t('short_video_use_account_default', '沿用账号')}</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('short_video_this_time_hint', '附加提示语')}</span>
            <textarea
              className="min-h-[48px] resize-none rounded-[6px] border border-input bg-newBgColorInner px-[6px] py-[4px] text-[12px] outline-none"
              placeholder={t('short_video_this_time_hint_placeholder', '例如：春节活动，希望视频更喜庆一点')}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('environment_prompt', '环境描述')}</span>
            <input
              type="text"
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              placeholder={t('environment_prompt_placeholder', '可选，如：面向海外用户')}
              value={environmentPrompt}
              onChange={(e) => setEnvironmentPrompt(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('default_audience', '受众描述')}</span>
            <input
              type="text"
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              placeholder={t('default_audience_placeholder', '例如：在职 3-5 年程序员')}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </label>

          {/* 可折叠：本次任务覆盖（参考 short_video 任务级 config 覆盖） */}
          <div className="mt-[4px] border-t border-newBorder pt-[8px]">
            <button
              type="button"
              className="flex w-full items-center justify-between text-[12px] text-textItemBlur hover:text-white"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>{t('short_video_task_overrides', '本次任务覆盖（可选）')}</span>
              <span>{showAdvanced ? '▼' : '▶'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-[8px] flex flex-col gap-[6px]">
          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('short_video_this_time_duration', '本次目标时长')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={durationOverride}
              onChange={(e) =>
                setDurationOverride(
                  e.target.value as DurationOverride
                )
              }
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="90">90s</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('short_video_this_time_tone', '本次语气')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={toneOverride}
              onChange={(e) =>
                setToneOverride(
                  e.target.value as ToneOverride
                )
              }
            >
              <option value="account">
                {t(
                  'short_video_use_account_default',
                  '沿用账号'
                )}
              </option>
              <option value="professional">{t('tone_professional', '专业')}</option>
              <option value="casual">{t('tone_casual', '轻松')}</option>
              <option value="funny">{t('tone_funny', '搞笑')}</option>
              <option value="authoritative">{t('tone_authoritative', '权威')}</option>
              <option value="serious">{t('tone_serious', '严肃')}</option>
              <option value="educational">{t('tone_educational', '教育')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('image_count', '图片数量')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={imageCount}
              onChange={(e) => setImageCount(e.target.value)}
            >
              <option value="">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="8">8</option>
              <option value="10">10</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('default_subtitle_preset', '字幕样式')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={subtitlePreset}
              onChange={(e) => setSubtitlePreset(e.target.value as SubtitlePresetVal)}
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="default">{t('subtitle_preset_default', '默认')}</option>
              <option value="highlight">{t('subtitle_preset_highlight', '突出')}</option>
              <option value="minimal">{t('subtitle_preset_minimal', '简洁')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('content_type', '内容类型')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentTypeVal)}
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="knowledge">{t('content_type_knowledge', '知识分享')}</option>
              <option value="book_review">{t('content_type_book_review', '读书视频')}</option>
              <option value="educational">{t('content_type_educational', '教育内容')}</option>
              <option value="trend_analysis">{t('content_type_trend_analysis', '趋势分析')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('orientation', '方向')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatioVal)}
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="9:16">9:16 竖屏</option>
              <option value="16:9">16:9 横屏</option>
              <option value="1:1">1:1</option>
              <option value="4:3">4:3</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('content_style', '内容形态')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={contentStyle}
              onChange={(e) => setContentStyle(e.target.value as ContentStyleVal)}
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="explain">{t('content_style_explain', '讲解')}</option>
              <option value="vlog">{t('content_style_vlog', 'Vlog')}</option>
              <option value="listicle">{t('content_style_listicle', '盘点')}</option>
              <option value="story">{t('content_style_story', '故事')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('script_style_preset', '脚本风格')}</span>
            <select
              className="h-[28px] rounded-[6px] border border-input bg-newBgColorInner px-[6px] text-[12px] outline-none"
              value={scriptStyle}
              onChange={(e) => setScriptStyle(e.target.value as ScriptStyleVal)}
            >
              <option value="account">{t('short_video_use_account_default', '沿用账号')}</option>
              <option value="tutorial">{t('script_style_tutorial', '教程')}</option>
              <option value="chat">{t('script_style_chat', '聊天')}</option>
              <option value="humor">{t('script_style_humor', '幽默')}</option>
              <option value="authority">{t('script_style_authority', '权威')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-[4px] text-[12px]">
            <span>{t('override_prompt_template', '提示词覆盖')}</span>
            <textarea
              className="min-h-[48px] resize-none rounded-[6px] border border-input bg-newBgColorInner px-[6px] py-[4px] text-[12px] outline-none"
              placeholder={t('override_prompt_placeholder', '可选，覆盖账号默认提示词模板')}
              value={overridePrompt}
              onChange={(e) => setOverridePrompt(e.target.value)}
            />
          </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 生成任务按钮 */}
      <div className="flex flex-col gap-[6px]">
        <button
          type="button"
          onClick={createTasks}
          disabled={creating || !selectedForTask.length}
          className={clsx(
            'h-[32px] rounded-[8px] px-[12px] text-[13px] font-[600] text-white',
            creating || !selectedForTask.length
              ? 'bg-btnSimple/60 cursor-not-allowed'
              : 'bg-[#612BD3] hover:bg-[#6e3ae3]'
          )}
        >
          {creating
            ? t(
                'short_video_creating_tasks',
                '任务创建中…'
              )
            : t(
                'short_video_create_tasks',
                '生成短视频任务'
              )}
        </button>
        {error && (
          <div className="text-[11px] text-[#F97066]">
            {error}
          </div>
        )}
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="mt-[4px] flex flex-col gap-[8px]">
          <div className="text-[13px] font-[600]">
            {t('short_video_tasks', '短视频任务')}
          </div>
          <div className="flex flex-col gap-[6px]">
            {tasks.map((task) => {
              const statusLabelMap: Record<
                ShortVideoTaskStatus,
                string
              > = {
                queued: t('short_video_status_queued', '排队中'),
                processing: t(
                  'short_video_status_processing',
                  '生成中'
                ),
                completed: t(
                  'short_video_status_completed',
                  '已完成'
                ),
                failed: t(
                  'short_video_status_failed',
                  '失败'
                ),
              };

              const statusColorMap: Record<
                ShortVideoTaskStatus,
                string
              > = {
                queued: 'bg-[#4B5563]',
                processing: 'bg-[#3B82F6]',
                completed: 'bg-[#16A34A]',
                failed: 'bg-[#DC2626]',
              };

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-[8px] rounded-[8px] border border-newBorder bg-newSettings px-[10px] py-[8px]"
                >
                  <div className="flex flex-1 flex-col gap-[4px]">
                    <div className="flex items-center gap-[6px]">
                      <span className="truncate text-[13px] font-[500]">
                        {task.integrationName}
                      </span>
                      <span className="rounded-[4px] bg-newBgColor px-[4px] py-[1px] text-[10px] text-textItemBlur">
                        {task.platformIdentifier}
                      </span>
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <span
                        className={clsx(
                          'rounded-full px-[6px] py-[1px] text-[10px] text-white',
                          statusColorMap[task.status]
                        )}
                      >
                        {statusLabelMap[task.status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[6px]">
                    {task.status === 'completed' && (
                      <>
                        <button
                          type="button"
                          className="rounded-[6px] border border-newBorder px-[8px] py-[4px] text-[11px]"
                          onClick={() => handlePreview(task)}
                        >
                          {t('preview', '预览')}
                        </button>
                        <button
                          type="button"
                          className="rounded-[6px] bg-[#612BD3] px-[8px] py-[4px] text-[11px] text-white"
                          onClick={() => handleInsertToPost(task)}
                        >
                          {t(
                            'short_video_insert_into_post',
                            '插入到当前帖子'
                          )}
                        </button>
                      </>
                    )}
                    {task.status === 'failed' && (
                      <span className="text-[11px] text-[#F97066]">
                        {task.errorMessage ||
                          t(
                            'short_video_task_failed',
                            'Task failed'
                          )}
                      </span>
                    )}
                    {(task.status === 'queued' || task.status === 'processing') && (
                      <span className="text-[11px] text-textItemBlur">
                        {t(
                          'short_video_task_waiting',
                          '等待生成中…'
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

