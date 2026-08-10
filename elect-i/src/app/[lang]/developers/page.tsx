import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { PageHero, Section, SectionHeader, DisclosureNote, CtaBand } from "@/components/marketing/section";
import { CodeBlock } from "@/components/marketing/code-block";
import { ApiFlow } from "@/components/marketing/api-flow";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = { title: "Merchant API" };

const BASE_URL_EXAMPLE = "https://elect-i-global.com";

export default async function DevelopersPage({ params }: PageProps<"/[lang]/developers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const d = dict.developers;

  const headers = [
    { name: "X-EIG-Key-Id", meaning: d.headerKeyId },
    { name: "X-EIG-Timestamp", meaning: d.headerTimestamp },
    { name: "X-EIG-Nonce", meaning: d.headerNonce },
    { name: "X-EIG-Signature", meaning: d.headerSignature },
  ];

  const endpoints = [
    { method: "POST", path: "/api/v1/orders", scope: "orders:write", tier: "Elite", title: d.createOrderTitle, body: d.createOrderBody },
    { method: "GET", path: "/api/v1/orders", scope: "orders:read", tier: "Merchant+", title: d.listOrdersTitle, body: d.listOrdersBody },
    { method: "GET", path: "/api/v1/orders/:id", scope: "orders:read", tier: "Merchant+", title: d.getOrderTitle, body: d.getOrderBody },
    { method: "POST", path: "/api/v1/orders/:id/cancel", scope: "orders:write", tier: "Elite", title: d.cancelOrderTitle, body: d.cancelOrderBody },
    { method: "GET", path: "/api/v1/wallet", scope: "wallet:read", tier: "Merchant+", title: d.walletTitle, body: d.walletBody },
  ];

  const errorRows: Array<[string, number, string]> = [
    ["missing_headers", 401, d.errMissingHeaders],
    ["unknown_key", 401, d.errUnknownKey],
    ["key_revoked", 401, d.errKeyRevoked],
    ["stale_timestamp", 401, d.errStaleTimestamp],
    ["replayed_nonce", 409, d.errReplayedNonce],
    ["bad_signature", 401, d.errBadSignature],
    ["account_suspended", 403, d.errAccountSuspended],
    ["tier_forbidden", 403, d.errTierForbidden],
    ["insufficient_funds", 402, d.errInsufficientFunds],
    ["credit_limit", 402, d.errCreditLimit],
    ["quota_exceeded", 429, d.errQuotaExceeded],
    ["moq_not_met", 422, d.errMoqNotMet],
    ["unknown_product", 422, d.errUnknownProduct],
    ["not_found", 404, d.errNotFound],
    ["already_claimed", 409, d.errAlreadyClaimed],
    ["invalid_state", 409, d.errInvalidState],
    ["server_error", 500, d.errServerError],
  ];

  const events = [
    { name: "order.created", label: d.eventOrderCreated },
    { name: "order.claimed", label: d.eventOrderClaimed },
    { name: "order.shipped", label: d.eventOrderShipped },
    { name: "order.delivered", label: d.eventOrderDelivered },
    { name: "order.cancelled", label: d.eventOrderCancelled },
    { name: "wallet.low_balance", label: d.eventWalletLow },
  ];

  const canonicalExample = `<timestamp>\nPOST\n/api/v1/orders\n<nonce>\n<raw request body>`;

  const signingExample = `const canonical = [timestamp, "POST", path, nonce, body].join("\\n");
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
);
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
const signature = [...new Uint8Array(sig)]
  .map((b) => b.toString(16).padStart(2, "0")).join("");`;

  const createRequest = `POST /api/v1/orders
X-EIG-Key-Id: eig_live_1a2b3c4d
X-EIG-Timestamp: 1769000000
X-EIG-Nonce: 6f9c1e07-...-b2
X-EIG-Signature: 4d5e...c1

{
  "idempotency_key": "order-9f2c",
  "external_ref": "I20260713175900",
  "on_behalf": true,
  "pay_from": "wallet",
  "items": [{ "sku": "EIG-4A7C21B9", "qty": 24 }],
  "external_items": [
    { "name": "USB-C 65W charger", "sku": "EIG-4A7C21B9",
      "qty": 24, "unit_price_cents": 1720 }
  ],
  "external_digest": "9b1f...e4"
}`;

  const createResponse = `201 Created

{
  "order_id": "b6f1...",
  "order_number": "EIG-20260722-0F3A1",
  "status": "awaiting_recipient",
  "claim_url": "https://elect-i-global.com/en/claim/xY...",
  "amount_charged": "412.80",
  "currency": "USD",
  "wallet_balance_after": "8190.40",
  "items_digest": "9b1f...e4",
  "digest_matches": true
}`;

  const curlExample = `curl -X POST ${BASE_URL_EXAMPLE}/api/v1/orders \\
  -H "X-EIG-Key-Id: $KEY_ID" \\
  -H "X-EIG-Timestamp: $TS" \\
  -H "X-EIG-Nonce: $(uuidgen)" \\
  -H "X-EIG-Signature: $SIG" \\
  -H "content-type: application/json" \\
  --data "$BODY"`;

  const copy = { copyLabel: dict.common.copy, copiedLabel: dict.common.copied };

  const zh = lang === "zh";

  return (
    <>
      <PageHero kicker={d.kicker} title={d.title} lead={d.lead} />

      {/* Live request → order → webhook walkthrough. */}
      <Section className="!pt-4">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-14">
          <div>
            <SectionHeader
              kicker={zh ? "端到端" : "End to end"}
              title={zh ? "一次 API 调用，一个完成的订单" : "One API call becomes a finished order"}
              lead={
                zh
                  ? "商户系统在确认付款的瞬间发起签名请求；ELECT-I 扣款、生成认领链接，并向你的端点推送事件。"
                  : "Your system fires one signed request the moment it confirms payment. ELECT-I charges the wallet, mints the claim link, and posts the event back to your endpoint."
              }
            />
            <Reveal delay={160} className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { k: zh ? "签名" : "Signed", v: "HMAC-SHA256" },
                { k: zh ? "幂等" : "Idempotent", v: zh ? "安全重试" : "Safe retries" },
                { k: "Webhooks", v: zh ? "6 个事件" : "6 events" },
              ].map((chip) => (
                <div key={chip.k} className="panel-flat px-3 py-3">
                  <p className="type-eyebrow text-ink-600">{chip.k}</p>
                  <p className="mt-1 font-mono text-xs text-accent-200">{chip.v}</p>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal delay={120}>
            <ApiFlow
              labels={{
                request: zh ? "请求" : "Request",
                response: zh ? "响应" : "Response",
                webhook: "Webhook",
                signed: zh ? "已签名请求" : "signed request",
              }}
            />
          </Reveal>
        </div>
      </Section>

      <Section className="!pt-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <DisclosureNote title={d.tierNoteTitle} icon="key">
              <p>{d.tierNoteBody}</p>
            </DisclosureNote>
          </Reveal>
          <Reveal delay={70}>
            <DisclosureNote title={d.baseUrlTitle} icon="globe">
              <p>{d.baseUrlNote}</p>
              <p className="font-mono text-accent-200">{BASE_URL_EXAMPLE}</p>
            </DisclosureNote>
          </Reveal>
        </div>
      </Section>

      {/* Authentication */}
      <Section mesh>
        <SectionHeader kicker="01" title={d.authTitle} lead={d.authLead} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 font-semibold text-ink-400">{d.headerName}</th>
                    <th className="px-4 py-3 font-semibold text-ink-400">{d.headerMeaning}</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h) => (
                    <tr key={h.name} className="border-b border-white/5 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-accent-200">
                        {h.name}
                      </td>
                      <td className="px-4 py-3 text-ink-400">{h.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal delay={80} className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-ink-100">{d.canonicalTitle}</h3>
              <p className="mt-1.5 text-sm text-ink-400">{d.canonicalLead}</p>
              <CodeBlock title="canonical" code={canonicalExample} {...copy} className="mt-3" />
              <p className="mt-2 text-xs text-ink-500">{d.canonicalNote}</p>
            </div>
          </Reveal>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div>
              <h3 className="text-sm font-bold text-ink-100">{d.signingTitle}</h3>
              <p className="mt-1.5 text-sm text-ink-400">{d.signingLead}</p>
              <CodeBlock title="sign.ts" code={signingExample} {...copy} className="mt-3" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <h3 className="text-sm font-bold text-ink-100">{d.curlTitle}</h3>
              <CodeBlock title="request.sh" code={curlExample} {...copy} className="mt-3" />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Endpoints */}
      <Section>
        <SectionHeader kicker="02" title={d.endpointsTitle} lead={d.endpointsLead} />
        <div className="mt-8 space-y-3">
          {endpoints.map((e, i) => (
            <Reveal key={e.path + e.method} delay={Math.min(i, 5) * 40}>
              <div className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={
                      e.method === "POST"
                        ? "rounded-md bg-accent-500/15 px-2 py-1 font-mono text-xs font-bold text-accent-200"
                        : "rounded-md bg-white/8 px-2 py-1 font-mono text-xs font-bold text-ink-300"
                    }
                  >
                    {e.method}
                  </span>
                  <code className="font-mono text-sm text-ink-100">{e.path}</code>
                  <span className="ml-auto flex items-center gap-2">
                    <Badge tone="neutral">{e.scope}</Badge>
                    <Badge tone={e.tier === "Elite" ? "verify" : "accent"}>{e.tier}</Badge>
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-400">{e.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div>
              <h3 className="text-sm font-bold text-ink-100">{d.requestLabel}</h3>
              <CodeBlock title="POST /api/v1/orders" code={createRequest} {...copy} className="mt-3" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <h3 className="text-sm font-bold text-ink-100">{d.responseLabel}</h3>
              <CodeBlock title="201 Created" code={createResponse} {...copy} className="mt-3" />
              <p className="mt-2 text-xs text-ink-500">{d.createOrderDigest}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Webhooks */}
      <Section mesh>
        <SectionHeader kicker="03" title={d.webhooksTitle} lead={d.webhooksLead} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <div className="flex flex-wrap gap-2">
              {events.map((event) => (
                <span
                  key={event.name}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink-300"
                >
                  <span className="font-mono text-xs text-accent-200">{event.name}</span>
                  <span className="ml-2 text-ink-500">{event.label}</span>
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={80} className="flex flex-col gap-4">
            <DisclosureNote title={d.webhookSigTitle} icon="webhook">
              <p>{d.webhookSigBody}</p>
            </DisclosureNote>
            <DisclosureNote title={d.webhookRetryTitle} icon="refresh">
              <p>{d.webhookRetryBody}</p>
            </DisclosureNote>
          </Reveal>
        </div>
      </Section>

      {/* Errors */}
      <Section>
        <SectionHeader kicker="04" title={d.errorsTitle} lead={d.errorsLead} />
        <Reveal delay={60} className="mt-8">
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-semibold text-ink-400">{d.errorCode}</th>
                  <th className="px-4 py-3 font-semibold text-ink-400">{d.errorStatus}</th>
                  <th className="px-4 py-3 font-semibold text-ink-400">{d.errorMeaning}</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map(([code, status, meaning]) => (
                  <tr key={code} className="border-b border-white/5 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-accent-200">
                      {code}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-300">{status}</td>
                    <td className="px-4 py-3 text-ink-400">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      <CtaBand title={d.ctaTitle} lead={d.ctaLead}>
        <ButtonLink href={`/${lang}/register?next=/${lang}/dashboard`} size="lg">
          {dict.nav.register}
        </ButtonLink>
        <ButtonLink href={`/${lang}/membership?upgrade=elite`} variant="secondary" size="lg">
          {dict.nav.pricing}
        </ButtonLink>
      </CtaBand>
    </>
  );
}
