"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Terminal-styled code sample with a copy button. Client-side only for the
 * clipboard call; the code itself is server-rendered inside the <pre>, so it
 * is selectable and readable without JavaScript.
 */
export function CodeBlock({
  title,
  code,
  copyLabel,
  copiedLabel,
  className,
}: {
  title: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the sample is selectable anyway.
    }
  }

  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="size-2.5 rounded-full bg-danger-500/60" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-verify-500/60" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-settled-500/60" aria-hidden="true" />
        <span className="ml-2 truncate font-mono text-xs text-ink-400">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-ink-300 transition-colors duration-200 hover:border-accent-400/40 hover:text-accent-200"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-ink-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
