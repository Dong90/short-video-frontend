'use client';

import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ShortVideoIntegrationSettings, ShortVideoIntegrationSettingsRef } from './short-video.integration.settings';
import { ToggleSwitch, CollapsibleSection } from './platform-config-section';
import { PersonaCreateModal } from './persona-create-modal';
import { PersonaEditModal } from './persona-edit-modal';

type ShortVideoTaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface ShortVideoTask {
  id: string;
  idea?: string;
  integrationId: string;
  integrationName: string;
  platformIdentifier: string;
  status: ShortVideoTaskStatus;
  workflowType?: string;
  videoUrl?: string;
  errorMessage?: string;
  createdAt?: string;
}

interface IntegrationInfo {
  id: string;
  name: string;
  identifier: string;
  disabled?: boolean;
  picture?: string;
}

type ShortVideoInfoTab = 'platform' | 'tasks';

export const ShortVideoInfoModal: FC<{
  integration: IntegrationInfo;
  onClose: () => void;
}> = ({ integration, onClose }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();

  const [tab, setTab] = useState<ShortVideoInfoTab>('platform');
  const [platformAccounts, setPlatformAccounts] = useState<Array<{ id: string; name: string; platform: string; avatar_url?: string; account_url?: string; description?: string }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [tasks, setTasks] = useState<ShortVideoTask[]>([]);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksPages, setTasksPages] = useState(1);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string; description?: string; persona_type?: string; avatar_url?: string; tags?: string[]; config?: Record<string, unknown> }>>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [deletingPersona, setDeletingPersona] = useState(false);
  const modals = useModals();
  const [personaListRefresh, setPersonaListRefresh] = useState(0);
  const [loadingPersona, setLoadingPersona] = useState(false);
  const [savingPersona, setSavingPersona] = useState(false);
  const [useFreeVideos, setUseFreeVideos] = useState(true);
  const settingsRef = useRef<ShortVideoIntegrationSettingsRef>(null);

  /** 内嵌模式下保存成功后的回调：仅显示 toast，不关闭父级弹窗 */
  const onEmbeddedSaveSuccess = useCallback(() => {
    toaster.show(t('short_video_config_saved', '短视频配置已保存'), 'success');
  }, [toaster, t]);

  const safeJson = useCallback(async (res: Response) => {
    try {
      const text = await res.text();
      if (!text?.trim()) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }, []);

  const savePersona = useCallback(async () => {
    if (!selectedAccountId) {
      toaster.show(t('short_video_select_account_first', '请先选择平台账号'), 'warning');
      return;
    }
    setSavingPersona(true);
    try {
      const cfgRes = await fetch(`/short-video/integration-config?platform_account_id=${encodeURIComponent(selectedAccountId)}`);
      const cfg = (cfgRes.ok ? await safeJson(cfgRes) : null) ?? {};
      const updated: Record<string, unknown> = { ...cfg, persona_id: selectedPersonaId || null, platform_account_id: selectedAccountId };
      if (integration?.id) updated.integration_id = integration.id;
      await fetch('/short-video/integration-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      toaster.show(t('persona_saved', '人设已保存到该账号'), 'success');
    } finally {
      setSavingPersona(false);
    }
  }, [selectedPersonaId, selectedAccountId, integration?.id, fetch, safeJson, toaster, t]);

  const refreshPersonas = useCallback(() => {
    setPersonaListRefresh((v) => v + 1);
  }, []);

  const openCreatePersonaModal = useCallback(() => {
    modals.openModal({
      askClose: false,
      closeOnEscape: true,
      withCloseButton: false,
      children: (close) => (
        <PersonaCreateModal
          onClose={close}
          onSuccess={(personaId) => {
            setSelectedPersonaId(personaId);
            refreshPersonas();
          }}
          selectedAccountId={selectedAccountId || undefined}
          postizIntegrationId={integration.id}
        />
      ),
    });
  }, [modals, selectedAccountId, refreshPersonas]);

  const openEditPersonaModal = useCallback(
    (personaId: string) => {
      modals.openModal({
        askClose: false,
        closeOnEscape: true,
        withCloseButton: false,
        children: (close) => (
          <PersonaEditModal personaId={personaId} onClose={close} onSuccess={refreshPersonas} />
        ),
      });
    },
    [modals, refreshPersonas]
  );

  const deletePersona = useCallback(async (id: string) => {
    if (!id) return;
    setDeletingPersona(true);
    try {
      const res = await fetch(`/short-video/personas/${id}`, { method: 'DELETE' });
      const data = await safeJson(res);
      if (res.ok) {
        toaster.show(t('persona_deleted', '人设已删除'), 'success');
        if (selectedPersonaId === id) setSelectedPersonaId('');
        setPersonaListRefresh((v) => v + 1);
      } else {
        toaster.show((data as any)?.message || t('persona_delete_failed', '人设删除失败'), 'warning');
      }
    } catch {
      toaster.show(t('persona_delete_failed', '人设删除失败'), 'warning');
    } finally {
      setDeletingPersona(false);
    }
  }, [fetch, safeJson, toaster, t, selectedPersonaId]);

  const normalizeTaskStatus = useCallback((s: string): ShortVideoTaskStatus => {
    const x = (s || '').toLowerCase();
    if (x === 'processing') return 'processing';
    if (x === 'completed') return 'completed';
    if (x === 'failed' || x === 'cancelled' || x === 'cancelling') return 'failed';
    return 'queued';
  }, []);

  const loadTasks = useCallback(async () => {
    if (!integration?.id) return;
    setLoadingTasks(true);
    try {
      const params = new URLSearchParams({
        integration_id: integration.id,
        limit: '10',
        page: String(tasksPage),
      });
      if (taskStatusFilter) params.set('status', taskStatusFilter);
      const res = await fetch(`/short-video/tasks?${params.toString()}`);
      const data = await safeJson(res);
      if (!res.ok) throw new Error((data as any)?.message || '获取任务列表失败');
      const list = (data?.tasks ?? data?.items ?? []) || [];
      const rows = list.map((task: Record<string, unknown>) => ({
        id: String(task.id ?? ''),
        idea: task.idea ? String(task.idea) : undefined,
        integrationId: String(task.integration_id ?? integration.id),
        integrationName: integration.name,
        platformIdentifier: integration.identifier,
        status: normalizeTaskStatus(String(task.status ?? '')),
        workflowType: task.workflow_type ? String(task.workflow_type) : undefined,
        videoUrl: task.video_url ? String(task.video_url) : undefined,
        errorMessage: task.error_message ? String(task.error_message) : undefined,
        createdAt: task.created_at ? String(task.created_at) : undefined,
      }));
      setTasks(rows);
      setTasksTotal(Number(data?.total ?? rows.length));
      setTasksPages(Number(data?.pages ?? 1));
    } catch {
      setTasks([]);
      setTasksTotal(0);
      setTasksPages(1);
    } finally {
      setLoadingTasks(false);
    }
  }, [integration?.id, integration?.name, integration?.identifier, tasksPage, taskStatusFilter, normalizeTaskStatus, safeJson]);

  // 加载平台账号列表（按 integration_id 筛选可只显示当前集成关联的账号）
  useEffect(() => {
    let cancelled = false;
    setLoadingAccounts(true);
    const params = new URLSearchParams({ status: 'active', limit: '100' });
    if (integration?.id) params.set('integration_id', integration.id);
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
        const accs = items.map((a: any) => {
          const cfg = a.config || {};
          return {
            id: a.id,
            name: a.name || a.id,
            platform: a.platform || '',
            avatar_url: pickAvatar(a),
            account_url: (typeof a.account_url === 'string' ? a.account_url : cfg.account_url)?.trim() || undefined,
            description: (typeof a.description === 'string' ? a.description : cfg.description)?.trim() || undefined,
          };
        });
        setPlatformAccounts(accs);
        if (accs.length > 0) {
          const match = accs.find((a: { platform: string }) => a.platform === integration.identifier) || accs[0];
          setSelectedAccountId(match.id);
        } else {
          setSelectedAccountId('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [integration?.id, integration?.identifier]);

  // 加载平台账号配置（用于平台 tab 的视频模式开关）
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    fetch(`/short-video/integration-config?platform_account_id=${encodeURIComponent(selectedAccountId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const v = d?.use_free_videos;
        setUseFreeVideos(v === false ? false : true);
      });
    return () => { cancelled = true; };
  }, [selectedAccountId, fetch]);

  // 对接 short_video API 获取人设、提示词、任务列表（按所选账号）
  useEffect(() => {
    let cancelled = false;

    const loadPersona = async () => {
      setLoadingPersona(true);
      let selectedId = '';
      try {
        const cfgUrl = selectedAccountId
          ? `/short-video/integration-config?platform_account_id=${encodeURIComponent(selectedAccountId)}`
          : '/short-video/integration-config';
        const [personasRes, cfgRes] = await Promise.all([
          fetch('/short-video/personas?status=active&limit=100'),
          selectedAccountId ? fetch(cfgUrl) : Promise.resolve(null),
        ]);
        const personasData = personasRes.ok ? await safeJson(personasRes) : null;
        const items = Array.isArray(personasData?.items)
          ? personasData.items
          : Array.isArray(personasData)
            ? personasData
            : [];
        if (!cancelled) {
          setPersonas(items.map((p: any) => ({
            id: p.id,
            name: p.name || p.id,
            description: p.description,
            persona_type: p.persona_type,
            avatar_url: p.avatar_url,
            tags: Array.isArray(p.tags) ? p.tags : [],
            config: p.config,
          })));
        }
        if (cfgRes?.ok) {
          const cfg = await safeJson(cfgRes);
          if (cfg?.persona_id && items.some((x: any) => x.id === cfg.persona_id)) selectedId = cfg.persona_id;
        }
        if (items.length === 0) selectedId = '';
        if (!cancelled) {
          setSelectedPersonaId(selectedId);
        }
      } catch {
      } finally {
        if (!cancelled) setLoadingPersona(false);
      }
    };

    loadTasks();
    if (selectedAccountId) {
      loadPersona();
    } else {
      setLoadingPersona(false);
    }

    return () => {
      cancelled = true;
    };
  }, [integration.id, integration.name, integration.identifier, selectedAccountId, fetch, t, personaListRefresh]);

  const statusLabel = useCallback((status: ShortVideoTaskStatus) => {
    switch (status) {
      case 'queued':
        return t('short_video_status_queued', '排队中');
      case 'processing':
        return t('short_video_status_processing', '生成中');
      case 'completed':
        return t('short_video_status_completed', '已完成');
      case 'failed':
        return t('short_video_status_failed', '失败');
      default:
        return status;
    }
  }, [t]);

  const tabs: { id: ShortVideoInfoTab; label: string }[] = [
    { id: 'platform', label: t('short_video_tab_account_config', '账号配置') },
    { id: 'tasks', label: t('short_video_tab_tasks', '创作记录') },
  ];

  return (
    <div className="w-[900px] max-w-[95vw] max-h-[85vh] bg-newBgColorInner rounded-[16px] flex flex-col text-textColor overflow-hidden shadow-xl">
      {/* Tabs + 关闭按钮（去掉顶部冗余显示，平台概览为首屏） */}
      <div className="flex items-center justify-between px-[20px] pt-[12px] pb-[12px] gap-[4px] border-b border-newBorder text-[13px] shrink-0">
        <div className="flex gap-[4px]">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx(
              'px-[16px] py-[10px] rounded-t-[8px] transition-all',
              tab === item.id
                ? 'bg-[#612BD3]/10 border-b-2 border-[#612BD3] -mb-[1px] text-white font-[600]'
                : 'text-textItemBlur hover:text-textColor hover:bg-newBorder/30'
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
        </div>
        <button
          type="button"
          className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-textItemBlur hover:text-white hover:bg-newBorder transition-colors shrink-0"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-[20px]">
        {tab === 'platform' && (
          <div className="flex flex-col gap-[16px]">
            {/* 1. 平台概览：当前频道（Postiz 与 short_video 一对一）+ 视频模式，开关在右侧 */}
            <div className="rounded-[10px] border border-newBorder bg-newSettings/50 p-[18px] flex flex-col gap-[14px]">
              <div className="flex items-center justify-between gap-[18px] flex-wrap">
                <div className="flex items-center gap-[18px] min-w-0 flex-1">
                  {(() => {
                    const acc = selectedAccountId ? platformAccounts.find((a) => a.id === selectedAccountId) : null;
                    // 优先使用账号头像
                    let avatarSrc = acc?.avatar_url || integration?.picture || null;
                    if (avatarSrc?.includes('/uploads/')) {
                      try {
                        const u = new URL(avatarSrc);
                        if (u.pathname.startsWith('/uploads/')) avatarSrc = u.pathname;
                      } catch {
                        /* skip */
                      }
                    }
                    const isValidAvatar = (s: string) => s?.startsWith?.('http') || s?.startsWith?.('/');
                    return (
                      <ImageWithFallback
                        fallbackSrc="/no-picture.jpg"
                        src={isValidAvatar(avatarSrc) ? avatarSrc : `/icons/platforms/${integration?.identifier ?? 'instagram'}.png`}
                        className="rounded-[10px] shrink-0 object-cover"
                        alt={acc?.name || integration.name}
                        width={56}
                        height={56}
                      />
                    );
                  })()}
                  <div className="flex flex-col gap-[6px] min-w-0 flex-1">
                    <div className="text-[15px] font-[600] truncate">
                      {integration?.name || (platformAccounts.find((a) => a.id === selectedAccountId)?.name ?? '')}
                    </div>
                    <div className="text-[12px] text-textItemBlur">
                      {t('platform', '平台')}: {integration?.identifier ?? (platformAccounts.find((a) => a.id === selectedAccountId)?.platform ?? '')}
                    </div>
                    {selectedAccountId && (() => {
                      const acc = platformAccounts.find((a) => a.id === selectedAccountId);
                      const url = acc?.account_url;
                      if (!url || !url.startsWith('http')) return null;
                      return (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-[#612BD3] hover:underline truncate"
                        >
                          {t('account_homepage', '主页链接')}
                        </a>
                      );
                    })()}
                    {selectedAccountId && (() => {
                      const acc = platformAccounts.find((a) => a.id === selectedAccountId);
                      const desc = acc?.description;
                      if (!desc) return null;
                      return (
                        <div className="text-[12px] text-textItemBlur leading-relaxed mt-[4px] line-clamp-2" title={desc}>
                          {desc}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-[4px] shrink-0">
                  <span className="text-[12px]">{t('video_mode', '视频模式')}</span>
                  <ToggleSwitch checked={useFreeVideos} onChange={(v) => {
                    setUseFreeVideos(v);
                    const cfg = settingsRef.current?.getConfig?.() ?? {};
                    settingsRef.current?.setConfig?.({ ...cfg, use_free_videos: v });
                  }} />
                  <span className="text-[11px] text-textItemBlur">{t('use_video_material', '使用视频素材')}</span>
                </div>
              </div>
              {platformAccounts.length === 0 && !loadingAccounts && (
                <div className="text-[12px] text-textItemBlur">
                  {t('short_video_no_platform_account', '暂无关联的平台账号，请先保存短视频配置。')}
                </div>
              )}
            </div>

            {/* 2. 人设区块（可折叠，仅选择 + 单独创建弹窗） */}
            <CollapsibleSection title={t('persona', '人设')} icon="👤" defaultOpen={false}>
              {loadingPersona ? (
                <div className="p-[32px] text-center text-textItemBlur text-[13px]">
                  {t('loading', '加载中...')}
                </div>
              ) : (
                <div className="flex flex-col gap-[14px]">
                  <div className="flex items-center justify-between gap-[12px] flex-wrap">
                    <div className="flex gap-[8px] items-center">
                      <select
                        className="h-[36px] min-w-[180px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/20"
                        value={selectedPersonaId}
                        onChange={(e) => setSelectedPersonaId(e.target.value)}
                      >
                        <option value="">{t('default', '默认')}</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {selectedPersonaId && (
                        <button
                          type="button"
                          onClick={savePersona}
                          disabled={savingPersona}
                          className="h-[36px] px-[16px] rounded-[8px] bg-[#612BD3] text-[13px] font-[500] text-white disabled:opacity-60 hover:opacity-90 shrink-0"
                        >
                          {savingPersona ? t('saving', '保存中…') : t('save_persona_to_account', '保存到账号')}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={openCreatePersonaModal}
                      className="h-[36px] px-[16px] rounded-[8px] border border-[#612BD3] text-[#612BD3] text-[13px] font-[500] hover:bg-[#612BD3]/10 shrink-0"
                    >
                      {t('create_persona', '创建人设')}
                    </button>
                  </div>
                  {selectedPersonaId && (() => {
                    const p = personas.find((x) => x.id === selectedPersonaId);
                    if (!p) return null;
                    return (
                      <div className="rounded-[10px] border border-newBorder bg-newBgColorInner/50 p-[16px] flex flex-col gap-[12px]">
                        <div className="flex items-center justify-between gap-[14px]">
                          <div className="flex items-center gap-[14px] min-w-0 flex-1">
                            <div className="relative w-[52px] h-[52px] rounded-[10px] overflow-hidden shrink-0">
                              {(() => {
                                let personaAvatar = p.avatar_url;
                                if (personaAvatar?.includes('/uploads/')) {
                                  try {
                                    const u = new URL(personaAvatar);
                                    if (u.pathname.startsWith('/uploads/')) personaAvatar = u.pathname;
                                  } catch {
                                    /* skip */
                                  }
                                }
                                return (personaAvatar && (personaAvatar.startsWith('http') || personaAvatar.startsWith('/'))) ? (
                                <ImageWithFallback
                                  src={personaAvatar}
                                  fallbackSrc="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                                  width={52}
                                  height={52}
                                  className="w-full h-full object-cover"
                                />
                              ) : null;
                              })()}
                              <div className="absolute inset-0 flex items-center justify-center bg-[#612BD3]/20 text-[#612BD3] text-[20px] font-[600] pointer-events-none -z-10">
                                {p.name?.charAt(0) || '?'}
                              </div>
                            </div>
                            <div className="flex flex-col gap-[4px] min-w-0">
                              <div className="text-[14px] font-[600] truncate">{p.name}</div>
                              <div className="text-[11px] text-textItemBlur">
                                {p.persona_type && `${p.persona_type} · `}ID: {p.id}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-[6px] shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditPersonaModal(p.id)}
                              className="h-[28px] px-[10px] rounded-[8px] border border-input text-[11px] hover:bg-newBorder/30"
                            >
                              {t('edit', '编辑')}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePersona(p.id)}
                              disabled={deletingPersona}
                              className="h-[28px] px-[10px] rounded-[8px] border border-red-500/50 text-[11px] text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              {t('delete', '删除')}
                            </button>
                          </div>
                        </div>
                        {p.description && (
                          <div className="text-[12px] text-textItemBlur leading-relaxed">{p.description}</div>
                        )}
                        {p.tags && p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-[6px]">
                            {p.tags.map((tag: string) => (
                              <span key={tag} className="px-[8px] py-[3px] rounded-[6px] bg-[#612BD3]/15 text-[11px] text-[#612BD3]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.config && Object.keys(p.config).length > 0 && (
                          <details className="text-[11px]">
                            <summary className="cursor-pointer text-textItemBlur hover:text-textColor">{t('config', 'config')}</summary>
                            <pre className="mt-[8px] p-[10px] rounded-[8px] bg-newBgColorInner overflow-auto max-h-[100px] text-[11px]">
                              {JSON.stringify(p.config, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CollapsibleSection>

            {/* 3. 短视频配置 */}
            <ShortVideoIntegrationSettings
              ref={settingsRef}
              integrationId="short_video"
              integrationIdentifier={integration.identifier}
              platformAccountId={selectedAccountId || undefined}
              postizIntegrationId={integration.id}
              integrationInfo={{ name: integration.name, picture: integration.picture }}
              onClose={onEmbeddedSaveSuccess}
              embedded
            />
          </div>
        )}

        {tab === 'tasks' && (
          <div className="rounded-[10px] border border-newBorder bg-newSettings/50 overflow-hidden flex flex-col">
            <div className="flex items-center gap-[12px] px-[18px] py-[14px] border-b border-newBorder flex-wrap">
              <select
                className="h-[34px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[12px] outline-none focus:ring-2 focus:ring-[#612BD3]/20"
                value={taskStatusFilter}
                onChange={(e) => {
                  setTaskStatusFilter(e.target.value);
                  setTasksPage(1);
                }}
              >
                <option value="">{t('all_status', '全部状态')}</option>
                <option value="pending">{t('short_video_status_queued', '排队中')}</option>
                <option value="processing">{t('short_video_status_processing', '生成中')}</option>
                <option value="completed">{t('short_video_status_completed', '已完成')}</option>
                <option value="failed">{t('short_video_status_failed', '失败')}</option>
              </select>
              <button
                type="button"
                onClick={() => loadTasks()}
                disabled={loadingTasks}
                className="h-[34px] px-[14px] rounded-[8px] bg-[#612BD3] text-[13px] font-[500] text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
              >
                {loadingTasks ? t('loading', '加载中...') : t('refresh', '刷新')}
              </button>
              <span className="text-[12px] text-textItemBlur ml-auto">
                {t('total', '共')} {tasksTotal} {t('items', '条')}
              </span>
            </div>
            {loadingTasks ? (
              <div className="p-[24px] text-center text-textItemBlur text-[13px]">
                {t('loading', '加载中...')}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-[40px] text-center">
                <div className="text-[13px] text-textItemBlur mb-[8px]">
                  {t('short_video_no_tasks', '暂无短视频任务，请在发帖页面创建任务。')}
                </div>
                <div className="text-[12px] text-textItemBlur/70">
                  {t('create_task_hint', '在发帖页面选择短视频，输入创意后即可创建任务')}
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-newBorder flex-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="px-[18px] py-[14px] text-[13px] flex flex-col gap-[8px] hover:bg-newBorder/20 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-[12px]">
                        <div className="flex items-center gap-[12px] min-w-0 flex-1">
                          <span className="font-[500] shrink-0">{task.integrationName}</span>
                          <span
                            className={clsx(
                              'px-[8px] py-[3px] rounded-[8px] text-[11px] shrink-0 font-[500]',
                              task.status === 'completed' && 'bg-green-500/20 text-green-400',
                              task.status === 'processing' && 'bg-blue-500/20 text-blue-400',
                              task.status === 'queued' && 'bg-amber-500/20 text-amber-400',
                              task.status === 'failed' && 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {statusLabel(task.status)}
                          </span>
                          {task.workflowType && (
                            <span className="text-[11px] text-textItemBlur shrink-0">
                              {task.workflowType}
                            </span>
                          )}
                        </div>
                        {task.videoUrl && (
                          <a
                            href={task.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-[30px] px-[12px] rounded-[8px] bg-[#612BD3]/20 text-[#612BD3] text-[12px] font-[500] hover:bg-[#612BD3]/30 transition-colors shrink-0 flex items-center"
                          >
                            {t('preview', '预览')}
                          </a>
                        )}
                      </div>
                      {task.idea && (
                        <div className="text-[12px] text-textItemBlur truncate" title={task.idea}>
                          {task.idea}
                        </div>
                      )}
                      {task.errorMessage && (
                        <div className="text-[11px] text-red-400" title={task.errorMessage}>
                          {task.errorMessage}
                        </div>
                      )}
                      {task.createdAt && (
                        <div className="text-[11px] text-textItemBlur">
                          {task.createdAt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {tasksPages > 1 && (
                  <div className="flex items-center justify-center gap-[8px] px-[16px] py-[12px] border-t border-newBorder">
                    <button
                      type="button"
                      className="h-[28px] px-[10px] rounded-[4px] border border-input text-[12px] disabled:opacity-50"
                      disabled={tasksPage <= 1}
                      onClick={() => setTasksPage((p) => Math.max(1, p - 1))}
                    >
                      {t('prev', '上一页')}
                    </button>
                    <span className="text-[12px] text-textItemBlur">
                      {tasksPage} / {tasksPages}
                    </span>
                    <button
                      type="button"
                      className="h-[28px] px-[10px] rounded-[4px] border border-input text-[12px] disabled:opacity-50"
                      disabled={tasksPage >= tasksPages}
                      onClick={() => setTasksPage((p) => Math.min(tasksPages, p + 1))}
                    >
                      {t('next', '下一页')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
