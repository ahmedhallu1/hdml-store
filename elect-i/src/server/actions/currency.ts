"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CURRENCY_CODES, CURRENCY_COOKIE } from "@/lib/currency";
import { safeNextPath } from "@/lib/validation";

/**
 * Remember a visitor's explicit currency choice for a year.
 *
 * A Server Action rather than an API route so the picker is a plain <form>:
 * with JavaScript it submits on change, and with JavaScript off the browser
 * posts the form and Next runs exactly the same code. Either way the response
 * is a redirect back to the page they were reading.
 *
 * Presentation only — this cookie never reaches an order, a payment or an
 * invoice. The worst a tampered value can do is fail the enum check below.
 */

const schema = z.object({
  currency: z.enum(CURRENCY_CODES, { error: "invalidSelection" }),
});

/**
 * Where to send the visitor back to when the form carried no `next` — the
 * page they submitted from, if the browser told us and it is ours. Same
 * open-redirect rules as `next`: cross-origin referers are discarded, not
 * followed.
 */
async function refererPath(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const referer = requestHeaders.get("referer");
    if (!referer) return null;
    const url = new URL(referer);
    const host = requestHeaders.get("host");
    if (host && url.host !== host) return null;
    return safeNextPath(`${url.pathname}${url.search}`);
  } catch {
    return null;
  }
}

export async function setDisplayCurrencyAction(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({ currency: formData.get("currency") });

  if (parsed.success) {
    const jar = await cookies();
    jar.set(CURRENCY_COOKIE, parsed.data.currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  // `next` is attacker-controlled: only a same-origin path survives. The
  // redirect matters most without JavaScript — it turns the POST into a clean
  // GET of the page they were reading, rather than a resubmittable result.
  redirect(safeNextPath(formData.get("next")) ?? (await refererPath()) ?? "/");
}
