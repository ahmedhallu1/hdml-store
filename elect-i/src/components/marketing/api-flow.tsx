"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

/**
 * Animated walkthrough of a single prepaid order: signed request → 201 →
 * claim link → webhook.
 *
 * Every payload here is the real shape of `POST /api/v1/orders` and the
 * `order.created` webhook (see src/app/api/v1/orders/route.ts). It is a
 * demonstration, not a live call — nothing is fetched — but a developer who
 * copies it gets something that actually validates, which is the whole point
 * of putting it on a marketing page.
 *
 * The sequence advances on a timer that only runs while the console is on
 * screen. The code is real text in a <pre>, so it stays selectable and
 * copyable at every step; the animation only changes which stage is
 * highlighted.
 */

interface Stage {
  key: string;
  method: string;
  label: string;
  tone: "request" | "success" | "event";
  body: string;
}

const STAGES: Stage[] = [
  {
    key: "request",
    method: "POST",
    label: "/api/v1/orders",
    tone: "request",
    body: `{
  "idempotency_key": "ord_9f2c41b8e7d0",
  "external_ref": "SO-20260713-8842",
  "external_source": "storefront",
  "on_behalf": true,
  "pay_from": "wallet",
  "recipient_email": "buyer@example.com",
  "items": [
    { "sku": "EIG-4A7C21B9", "qty": 24 }
  ]
}`,
  },
  {
    key: "response",
    method: "201",
    label: "Created",
    tone: "success",
    body: `{
  "order_id": "6f1b0c2e-…",
  "order_number": "EIG-20260722-0F3A1",
  "status": "awaiting_recipient",
  "claim_url": "https://elect-i-global.com/en/claim/…",
  "claim_expires_at": "2026-08-21T09:14:02.000Z",
  "amount_charged": "412.80",
  "currency": "USD",
  "wallet_balance_after": "8190.40",
  "items_digest": "b7c4…",
  "digest_matches": null
}`,
  },
  {
    key: "webhook",
    method: "POST",
    label: "your endpoint · order.created",
    tone: "event",
    body: `{
  "order_id": "6f1b0c2e-…",
  "order_number": "EIG-20260722-0F3A1",
  "external_ref": "SO-20260713-8842",
  "claim_url": "https://elect-i-global.com/en/claim/…"
}`,
  },
];

const TONE_DOT: Record<Stage["tone"], string> = {
  request: "bg-accent-400",
  success: "bg-settled-400",
  event: "bg-verify-400",
};
const TONE_TEXT: Record<Stage["tone"], string> = {
  request: "text-accent-300",
  success: "text-settled-400",
  event: "text-verify-400",
};

export function ApiFlow({
  labels,
}: {
  labels: { request: string; response: string; webhook: string; signed: string };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // A static first stage is a complete experience.

    const io = new IntersectionObserver((entries) => {
      visible.current = entries[0]?.isIntersecting ?? false;
    });
    io.observe(el);

    const id = window.setInterval(() => {
      if (!visible.current || paused || document.hidden) return;
      setActive((current) => (current + 1) % STAGES.length);
    }, 2800);

    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [paused]);

  const stageNames = [labels.request, labels.response, labels.webhook];
  const stage = STAGES[active];

  return (
    <div
      ref={ref}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="panel grain overflow-hidden"
    >
      {/* Console chrome */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.02] px-4 py-3">
        <span className="size-2.5 rounded-full bg-danger-500/50" />
        <span className="size-2.5 rounded-full bg-verify-500/50" />
        <span className="size-2.5 rounded-full bg-settled-500/50" />
        <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
          <Icon name="shield" className="size-3.5 text-accent-500" />
          {labels.signed}
        </span>
      </div>

      {/* Stage rail — also the manual control, so nothing is hover-only. */}
      <div
        role="tablist"
        aria-label={labels.request}
        className="flex items-center gap-1 border-b border-white/8 px-3 py-2"
      >
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "relative cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-200",
              i === active ? "text-ink-100" : "text-ink-600 hover:text-ink-300",
            )}
          >
            <span
              className={cn(
                "mr-1.5 inline-block size-1.5 rounded-full align-middle transition-opacity",
                TONE_DOT[s.tone],
                i === active ? "opacity-100" : "opacity-35",
              )}
            />
            {stageNames[i]}
            {i === active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-1.5 -bottom-px h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent"
              />
            ) : null}
          </button>
        ))}
      </div>

      {/* Request line */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 font-mono text-[11.5px]">
        <span className={cn("font-semibold", TONE_TEXT[stage.tone])}>{stage.method}</span>
        <span className="truncate text-ink-500">{stage.label}</span>
      </div>

      {/*
        Fixed min-height so switching stages never reflows the section around
        it — a jumping panel is the fastest way to make a page feel cheap.
      */}
      <div className="relative min-h-[19rem]">
        {/*
          `key` remounts on stage change to replay the fade. No `both` fill and
          the pre's resting state is fully visible, so a paused animation
          timeline (hidden tab) can never leave the code invisible.
        */}
        <pre
          key={stage.key}
          className="fade-in-soft overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-ink-300"
        >
          <code>{stage.body}</code>
        </pre>
      </div>
    </div>
  );
}
