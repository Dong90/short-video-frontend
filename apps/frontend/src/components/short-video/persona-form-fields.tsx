'use client';

import React, { FC } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

/** 与 short_video 人设 API 对齐：persona_type 可选值 */
const PERSONA_TYPE_OPTIONS = [
  { value: 'influencer', label: 'influencer' },
  { value: 'expert', label: 'expert' },
  { value: 'storyteller', label: 'storyteller' },
  { value: 'custom', label: 'custom' },
] as const;

export interface PersonaFormValue {
  name: string;
  description: string;
  persona_type: string;
  avatar_url: string;
  tags: string;
  config: string;
}

export const PersonaFormFields: FC<{
  value: PersonaFormValue;
  onChange: (v: PersonaFormValue) => void;
  showHint?: boolean;
}> = ({ value, onChange, showHint }) => {
  const t = useT();
  const set = (k: keyof PersonaFormValue, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-[12px] pt-[4px] border-t border-newBorder">
      {showHint && (
        <span className="text-[12px] text-textItemBlur">{t('persona_create_hint', '填写以下字段创建人设')}</span>
      )}
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_name', '人设名称')}</span>
        <input
          type="text"
          className="h-[36px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          placeholder={t('persona_name_placeholder', '请输入人设名称')}
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_type', '人设类型')}</span>
        <select
          className="h-[36px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          value={value.persona_type}
          onChange={(e) => set('persona_type', e.target.value)}
        >
          {PERSONA_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_description', '人设描述')}</span>
        <textarea
          className="min-h-[64px] resize-none rounded-[8px] border border-input bg-newBgColorInner px-[10px] py-[8px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          placeholder={t('persona_description_placeholder', '描述人设风格、特点等')}
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_avatar_url', '头像 URL')}</span>
        <input
          type="text"
          className="h-[36px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          placeholder={t('persona_avatar_placeholder', 'http(s):// 或 /uploads/...')}
          value={value.avatar_url}
          onChange={(e) => set('avatar_url', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_tags', '标签')}</span>
        <input
          type="text"
          className="h-[36px] rounded-[8px] border border-input bg-newBgColorInner px-[10px] text-[13px] outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          placeholder={t('persona_tags_placeholder', '逗号或空格分隔')}
          value={value.tags}
          onChange={(e) => set('tags', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[12px]">{t('persona_config_json', 'config (JSON)')}</span>
        <textarea
          className="min-h-[80px] resize-y rounded-[8px] border border-input bg-newBgColorInner px-[10px] py-[8px] text-[12px] font-mono outline-none focus:ring-2 focus:ring-[#612BD3]/30"
          placeholder={t('persona_config_placeholder', '{"key": "value"} 可选，人设扩展配置')}
          value={value.config}
          onChange={(e) => set('config', e.target.value)}
        />
      </label>
    </div>
  );
};
