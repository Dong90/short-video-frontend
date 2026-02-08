"use client";

import { useEffect, useState } from "react";

const OPENCUT_URL =
  process.env.NEXT_PUBLIC_OPENCUT_URL || "http://localhost:3001";

export default function VideoEditorPage() {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 简单探测一下 OPENCUT_URL 是否可访问，如果返回 404 也无所谓（有些部署没有 /api）
    fetch(OPENCUT_URL, { method: "GET" })
      .then(() => setReady(true))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "OpenCut 服务不可访问，请检查配置"
        );
      });
  }, []);

  if (error && !ready) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-newBgColorInner">
        <p className="text-destructive text-center">{error}</p>
        <p className="text-textItemBlur text-center text-sm">
          请确保 OpenCut 服务已启动，且 NEXT_PUBLIC_OPENCUT_URL 配置正确
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReady(false);
          }}
          className="rounded-md border border-newBgLineColor px-3 py-1.5 text-sm text-newTextColor hover:bg-newBgLineColor/20"
        >
          重试
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-newBgColorInner">
        <p className="text-textItemBlur text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-newBgColorInner">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-newBgLineColor px-3 py-2">
        <div className="text-sm text-textItemBlur">
          你可以直接在下方嵌入的 OpenCut 编辑器中创建和管理项目。
        </div>
        <a
          href={OPENCUT_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-newBgLineColor px-3 py-1.5 text-sm text-newTextColor hover:bg-newBgLineColor/20"
        >
          在新窗口打开 OpenCut
        </a>
      </div>

      <iframe
        src={OPENCUT_URL}
        title="OpenCut 视频编辑器"
        className="min-h-0 flex-1 border-0"
        allowFullScreen
      />
    </div>
  );
}
