"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

/** Copy-to-clipboard with a transient confirmation. */
export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be blocked by permissions; the value stays selectable.
        }
      }}
      className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 text-xs font-semibold text-ink-200 transition-colors hover:border-accent-400/40 hover:bg-white/10"
    >
      <Icon name={copied ? "check" : "link"} className="size-3.5" />
      {copied ? copiedLabel : label}
    </button>
  );
}
