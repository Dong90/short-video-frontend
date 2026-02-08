'use client';

import React, { FC, useCallback, useState } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { PersonaFormFields, type PersonaFormValue } from './persona-form-fields';

export const PersonaCreateModal: FC<{
  onClose: () => void;
  onSuccess?: (personaId: string) => void;
  selectedAccountId?: string;
  /** Postiz 集成 ID，用于关联 platform_account */
  postizIntegrationId?: string;
}> = ({ onClose, onSuccess, selectedAccountId, postizIntegrationId }) => {
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
  const [creating, setCreating] = useState(false);

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

  const bindToAccount = useCallback(
    async (personaId: string) => {
      if (!selectedAccountId) return;
      try {
        const cfgRes = await fetch(`/short-video/integration-config?platform_account_id=${encodeURIComponent(selectedAccountId)}`);
        const cfg = (cfgRes.ok ? await cfgRes.json().catch(() => null) : null) ?? {};
        const body: Record<string, unknown> = { ...cfg, persona_id: personaId, platform_account_id: selectedAccountId };
        if (postizIntegrationId) body.integration_id = postizIntegrationId;
        await fetch('/short-video/integration-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        // ignore
      }
    },
    [selectedAccountId, postizIntegrationId, fetch]
  );

  const handleCreate = useCallback(async () => {
    if (!form.name?.trim()) {
      toaster.show(t('persona_name_required', '请输入人设名称'), 'warning');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/short-video/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.id) {
        toaster.show(t('persona_created', '人设创建成功'), 'success');
        if (selectedAccountId) await bindToAccount(data.id);
        onSuccess?.(data.id);
        onClose();
      } else {
        toaster.show((data as any)?.message || t('persona_create_failed', '人设创建失败'), 'warning');
      }
    } catch {
      toaster.show(t('persona_create_failed', '人设创建失败'), 'warning');
    } finally {
      setCreating(false);
    }
  }, [form, fetch, buildPayload, toaster, t, onSuccess, onClose, selectedAccountId, bindToAccount]);

  return (
    <div className="w-[520px] max-w-[95vw] max-h-[90vh] bg-newBgColorInner rounded-[16px] flex flex-col text-textColor overflow-hidden shadow-xl">
      <div className="flex items-center justify-between h-[56px] px-[20px] border-b border-newBorder shrink-0">
        <div className="text-[16px] font-[600]">{t('create_persona', '创建人设')}</div>
        <button type="button" className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-textItemBlur hover:text-white hover:bg-newBorder transition-colors" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-[20px] flex flex-col gap-[16px]">
        <PersonaFormFields value={form} onChange={setForm} showHint />
        <div className="flex gap-[8px] pt-[8px]">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !form.name?.trim()}
            className="h-[36px] px-[16px] rounded-[8px] bg-[#612BD3] text-[13px] font-[500] text-white disabled:opacity-60 hover:opacity-90"
          >
            {creating ? t('creating', '创建中…') : t('create', '创建')}
          </button>
          <button type="button" onClick={onClose} className="h-[36px] px-[16px] rounded-[8px] border border-input text-[12px] hover:bg-newBorder/30">
            {t('cancel', '取消')}
          </button>
        </div>
      </div>
    </div>
  );
};
