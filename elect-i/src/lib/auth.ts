import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import type { Account, ActorKind } from "@/lib/db-types";
import { atLeast, privilegesFor, type Tier, type TierPrivileges } from "@/lib/tiers";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

export async function getUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireUser(locale: Locale, returnTo?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/${locale}/login${next}`);
  }
  return user;
}

/**
 * The account row for the signed-in user, or null. Read with the service role
 * because the tier drives pricing and must not be shaped by client RLS.
 */
export async function getAccount(): Promise<Account | null> {
  const user = await getUser();
  if (!user) return null;
  return getAccountByUserId(user.id);
}

export async function getAccountByUserId(userId: string): Promise<Account | null> {
  const service = supabaseService();
  const { data, error } = await service
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("account fetch failed:", error.message);
    return null;
  }
  return (data as Account | null) ?? null;
}

/**
 * Create the account row on first sign-in. Auth users are shared with the
 * HDML store, so an HDML customer visiting ELECT-I will not have one yet.
 */
export async function ensureAccount(user: User, locale: Locale = DEFAULT_LOCALE): Promise<Account> {
  const existing = await getAccountByUserId(user.id);
  if (existing) return existing;

  const service = supabaseService();
  const { data, error } = await service
    .from("accounts")
    .insert({
      user_id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? "",
      locale,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create account: ${error.message}`);
  return data as Account;
}

export async function requireAccount(locale: Locale, returnTo?: string): Promise<Account> {
  const user = await requireUser(locale, returnTo);
  const account = await ensureAccount(user, locale);
  if (account.suspended) redirect(`/${locale}/account/suspended`);
  return account;
}

/**
 * Gate a page or action on a minimum tier. Returns the account and its
 * resolved privileges so callers never re-derive them from a client value.
 */
export async function requireTier(
  locale: Locale,
  minimum: Tier,
  returnTo?: string,
): Promise<{ account: Account; privileges: TierPrivileges }> {
  const account = await requireAccount(locale, returnTo);
  if (!atLeast(account.tier, minimum) || account.tier_status !== "active") {
    redirect(`/${locale}/membership?upgrade=${minimum}`);
  }
  return { account, privileges: privilegesFor(account.tier) };
}

/** Privileges for the current visitor; anonymous visitors get Buyer rules. */
export async function currentPrivileges(): Promise<{ tier: Tier; privileges: TierPrivileges }> {
  const account = await getAccount();
  const tier: Tier = account && account.tier_status === "active" ? account.tier : "buyer";
  return { tier, privileges: privilegesFor(tier) };
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const service = supabaseService();
  const { data } = await service
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Admin gate. 404s rather than revealing that an admin area exists when the
 * visitor is a regular account.
 */
export async function requireAdmin(locale: Locale): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!(await isAdminUser(user.id))) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export async function auditLog(
  actor: ActorKind,
  actorId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const service = supabaseService();
  // Best-effort: an audit failure must never break the operation itself, but
  // it should be visible in logs.
  const { error } = await service.from("audit_logs").insert({
    actor,
    actor_id: actorId,
    action,
    entity: entity ?? null,
    entity_id: entityId ?? null,
    meta: meta ?? {},
  });
  if (error) console.error("audit log insert failed:", error.message);
}
