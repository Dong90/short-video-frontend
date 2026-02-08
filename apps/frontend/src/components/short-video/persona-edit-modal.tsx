'use client';

import React, { FC, useCallback, useEffect, useState } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PersonaFormFields, type PersonaFormValue } from './persona-form-fields';

export const PersonaEditModal: FC<{
  personaId: string;
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ personaId, onClose, onSuccess }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [form, setForm] = useState<PersonaFormValue>({
    name: '',
    description: '',
    persona_type: 'custom',
    avatar_url: '',
    tags: '',
    config: '',
  });
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/short-video/personas/${personaId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (cancelled || !p) return;
        const desc = p.config?.persona_description ?? p.description ?? '';
        const tagsArr = Array.isArray(p.tags) ? p.tags : [];
        const configObj = p.config && typeof p.config === 'object' ? p.config : {};
        const configStr = Object.keys(configObj).length > 0 ? JSON.stringify(configObj, null, 2) : '';
        setForm({
          name: p.name || '',
          description: typeof desc === 'string' ? desc : '',
          persona_type: p.persona_type || 'custom',
          avatar_url: p.avatar_url || '',
          tags: tagsArr.join(', '),
          config: configStr,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId, fetch]);

  const buildPayload = useCallback(() => {
    const name = form.name?.trim();
    const description = form.description?.trim();
    const avatarUrl = form.avatar_url?.trim();
    const tagsStr = form.tags?.trim();
    const configStr = form.config?.trim();
    const tags = tagsStr ? tagsStr.split(/[,，\s]+/).filter(Boolean) : [];
    const payload: Record<string, unknown> = {
      name: name || '',
      persona_type: form.persona_type || 'custom',
      status: 'active',
    };
    if (description) payload.description = description;
    let config: Record<string, unknown> = {};
    if (configStr) {
      try {
        const parsed = JSON.parse(configStr);
        if (parsed && typeof parsed === 'object') config = parsed;
      } catch {
        if (description) config = { persona_description: description };
      }
    }
    if (description) config = { ...config, persona_description: description };
    if (Object.keys(config).length > 0) payload.config = config;
    if (avatarUrl) payload.avatar_url = avatarUrl;
    else payload.avatar_url = null;
    payload.tags = tags;
    return payload;
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!form.name?.trim()) {
      toaster.show(t('persona_name_required', '请输入人设名称'), 'warning');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/short-video/personas/${personaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toaster.show(t('persona_updated', '人设更新成功'), 'success');
        onSuccess?.();
        onClose();
      } else {
        toaster.show((data as any)?.message || t('persona_update_failed', '人设更新失败'), 'warning');
      }
    } catch {
      toaster.show(t('persona_update_failed', '人设更新失败'), 'warning');
    } finally {
      setUpdating(false);
    }
  }, [personaId, form, fetch, buildPayload, toaster, t, onSuccess, onClose]);

  return (
    <div className="w-[520px] max-w-[95vw] max-h-[90vh] bg-newBgColorInner rounded-[16px] flex flex-col text-textColor overflow-hidden shadow-xl">
      <div className="flex items-center justify-between h-[56px] px-[20px] border-b border-newBorder shrink-0">
        <div className="text-[16px] font-[600]">{t('edit_persona', '编辑人设')}</div>
        <button type="button" className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-textItemBlur hover:text-white hover:bg-newBorder transition-colors" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[16px]">
        {loading ? (
          <div className="p-[32px] text-center text-textItemBlur text-[13px]">{t('loading', '加载中...')}</div>
        ) : (
          <>
            <PersonaFormFields value={form} onChange={setForm} showHint={false} />
            <div className="flex gap-[8px] pt-[8px]">
              <button
                type="button"
                onClick={handleSave}
                disabled={updating || !form.name?.trim()}
                className="h-[36px] px-[16px] rounded-[8px] bg-[#612BD3] text-[13px] font-[500] text-white disabled:opacity-60 hover:opacity-90"
              >
                {updating ? t('saving', '保存中…') : t('save', '保存')}
              </button>
              <button type="button" onClick={onClose} className="h-[36px] px-[16px] rounded-[8px] border border-input text-[12px] hover:bg-newBorder/30">
                {t('cancel', '取消')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
