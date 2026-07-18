/**
 * One-time Meta connect: run after the owner provides META_APP_ID,
 * META_APP_SECRET and META_USER_TOKEN (in .env.local). This:
 *   1. exchanges the short-lived user token for a long-lived Page token,
 *   2. discovers the Facebook Page ID + Instagram Business account ID,
 *   3. saves the IDs into the social config (site_settings),
 *   4. prints the Page token so it can be set as the META_ACCESS_TOKEN secret.
 *
 * Usage: npx tsx scripts/connect-meta.ts ["Page name hint"]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { exchangeAndDiscover } from "../src/lib/social/connect";
import { DEFAULT_SOCIAL_CONFIG, type SocialConfig } from "../src/lib/social/types";

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = createRequire(import.meta.url)("ws").WebSocket;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const userToken = process.env.META_USER_TOKEN;
  if (!appId || !appSecret || !userToken) {
    throw new Error("Set META_APP_ID, META_APP_SECRET and META_USER_TOKEN in .env.local first (see docs/SOCIAL-SETUP.md).");
  }

  const conn = await exchangeAndDiscover(appId, appSecret, userToken, process.argv[2]);
  console.log("✔ Connected:");
  console.log("  Facebook Page: ", conn.pageName, `(${conn.pageId})`);
  console.log("  Instagram:     ", conn.igUsername ? `@${conn.igUsername} (${conn.igUserId})` : "(not linked — Facebook only)");

  // Save IDs into the social config (does NOT store the token in the DB).
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await db.from("site_settings").select("value").eq("key", "social_config").maybeSingle();
  const current = (data?.value ?? {}) as Partial<SocialConfig>;
  const next: SocialConfig = {
    ...DEFAULT_SOCIAL_CONFIG,
    ...current,
    weeklySlot: { ...DEFAULT_SOCIAL_CONFIG.weeklySlot, ...(current.weeklySlot ?? {}) },
    platforms: { ...DEFAULT_SOCIAL_CONFIG.platforms, ...(current.platforms ?? {}) },
    fbPageId: conn.pageId,
    igUserId: conn.igUserId,
  };
  const { error } = await db.from("site_settings").upsert({ key: "social_config", value: next }, { onConflict: "key" });
  if (error) throw new Error(`Saving config failed: ${error.message}`);
  console.log("✔ Saved Page/IG IDs into the social config.");

  console.log("\nNEXT: set the Page token as the Worker secret (run this and paste the token below when asked):");
  console.log("  npx wrangler secret put META_ACCESS_TOKEN");
  console.log("\nPage token (long-lived):\n" + conn.pageToken);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
