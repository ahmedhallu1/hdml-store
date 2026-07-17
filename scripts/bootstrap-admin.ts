/**
 * Create (or find) a user and grant them store-admin rights.
 * The account is created with a random password that is never shown anywhere —
 * the owner sets their real password via "Forgot password?" on the login page.
 *
 * Usage: npx tsx scripts/bootstrap-admin.ts <email> [display name]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

if (typeof globalThis.WebSocket === "undefined") {
  const nodeRequire = createRequire(import.meta.url);
  (globalThis as { WebSocket?: unknown }).WebSocket = nodeRequire("ws").WebSocket;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const email = process.argv[2]?.trim().toLowerCase();
const displayName = process.argv[3] ?? "Admin";
if (!email) {
  console.error("Usage: npx tsx scripts/bootstrap-admin.ts <email> [display name]");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  // Find existing user by email (paged; tiny user base at bootstrap time).
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomBytes(24).toString("base64url"), // never stored or shown
      user_metadata: { full_name: displayName },
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    userId = data.user!.id;
    console.log(`Created user ${email} (${userId}).`);
  } else {
    console.log(`User ${email} already exists (${userId}).`);
  }

  const { error: profileErr } = await db
    .from("customer_profiles")
    .upsert({ user_id: userId, full_name: displayName }, { onConflict: "user_id" });
  if (profileErr) throw new Error(`customer_profiles upsert failed: ${profileErr.message}`);

  const { error: adminErr } = await db
    .from("admin_profiles")
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: "user_id" });
  if (adminErr) throw new Error(`admin_profiles upsert failed: ${adminErr.message}`);

  console.log(`✔ ${email} is now a store admin.`);
  console.log(`  To sign in: open the site → Sign in → "Forgot password?" → ${email},`);
  console.log(`  then follow the email link and set your password.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
