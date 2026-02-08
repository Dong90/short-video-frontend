'use client';

import React, { FC, useState } from 'react';
import clsx from 'clsx';

/** 可折叠配置区块 - 按设计图风格 */
export const CollapsibleSection: FC<{
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[10px] border border-newBorder bg-newSettings/50 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-[16px] py-[12px] text-left hover:bg-newBorder/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-[10px]">
          {icon && <span className="text-[#612BD3] text-[16px]">{icon}</span>}
          <span className="text-[14px] font-[600] text-white">{title}</span>
        </div>
        <span className="text-[11px] text-textItemBlur">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="px-[16px] pb-[16px] pt-[4px] border-t border-newBorder">{children}</div>}
    </div>
  );
};

/** 数值滑块 - 支持 min/max/step，显示格式根据 step 自动调整 */
export const WeightSlider: FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}> = ({ label, value, onChange, min = 0, max = 1, step = 0.01, format }) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const display = format ? format(value) : (step >= 1 ? String(value) : value.toFixed(2));
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex justify-between items-center">
        <span className="text-[12px] text-textItemBlur">{label}</span>
        <span className="text-[12px] font-mono text-white min-w-[36px] text-right">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="weight-slider w-full h-[6px] rounded-full appearance-none cursor-pointer bg-newBorder"
        style={{
          background: `linear-gradient(to right, #612BD3 0%, #612BD3 ${pct}%, var(--new-border) ${pct}%, var(--new-border) 100%)`,
        }}
      />
    </div>
  );
};

/** 切换开关 - 与设计图蓝色开关一致 */
export const ToggleSwitch: FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <div className="flex items-center justify-between gap-[12px]">
    {label && <span className="text-[12px] text-textItemBlur">{label}</span>}
    <div
      className={clsx(
        'w-[48px] h-[26px] rounded-full p-[3px] cursor-pointer transition-colors flex items-center',
        checked ? 'bg-[#612BD3] justify-end' : 'bg-newBorder justify-start'
      )}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <div className="w-[20px] h-[20px] rounded-full bg-white flex-shrink-0 transition-all" />
    </div>
  </div>
);
