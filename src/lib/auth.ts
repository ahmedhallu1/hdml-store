import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export async function getUser(): Promise<User | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Redirects to /login (with return path) when not authenticated. */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
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
 * Admin gate for pages and server actions. 404s instead of revealing that an
 * admin area exists when the visitor is a regular customer.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (!(await isAdminUser(user.id))) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export async function auditLog(
  adminId: string,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const service = supabaseService();
  // Best-effort: an audit failure must never break the admin operation itself,
  // but it should be visible in logs.
  const { error } = await service.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    entity: entity ?? null,
    entity_id: entityId ?? null,
    meta: meta ?? {},
  });
  if (error) console.error("audit log insert failed:", error.message);
}
