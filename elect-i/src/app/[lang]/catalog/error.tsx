"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

/**
 * Error boundaries are Client Components, so they cannot await the dictionary.
 * The four strings needed here are inlined for both locales rather than pulling
 * the whole dictionary into the client bundle.
 */
const COPY = {
  en: {
    title: "We couldn't load these results",
    body: "The catalog service did not respond. This is usually temporary.",
    retry: "Try again",
    reference: "Reference",
  },
  zh: {
    title: "无法加载搜索结果",
    body: "目录服务暂无响应，通常为临时问题。",
    retry: "重试",
    reference: "错误编号",
  },
} as const;

export default function CatalogError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const params = useParams<{ lang?: string }>();
  const copy = params?.lang === "zh" ? COPY.zh : COPY.en;

  useEffect(() => {
    console.error("catalog route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="grid size-14 place-items-center rounded-2xl border border-danger-500/30 bg-danger-500/10 text-danger-400">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 7.4v5.2M12 16.1v.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-50">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-400">{copy.body}</p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="glow-accent mt-7 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-accent-500 to-accent-400 px-6 font-bold text-obsidian-950 transition-all duration-200 hover:from-accent-400 hover:to-accent-300 active:scale-[0.98]"
      >
        {copy.retry}
      </button>
      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-ink-600">
          {copy.reference}: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
