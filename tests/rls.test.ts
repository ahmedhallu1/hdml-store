/**
 * Row Level Security verification against a REAL Supabase project.
 * Skipped automatically when .env.local is not configured (CI without secrets).
 * Run after migrations + catalog import: npm run test
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local the same way the importer does (tests run outside Next).
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const configured = Boolean(url && anonKey && !url.includes("placeholder"));

describe.skipIf(!configured)("RLS: anonymous client", () => {
  const anon = () => createClient(url!, anonKey!, { auth: { persistSession: false } });

  it("can read ACTIVE products only", async () => {
    const { data: active, error } = await anon()
      .from("products")
      .select("id, active")
      .limit(5);
    expect(error).toBeNull();
    for (const p of active ?? []) expect(p.active).toBe(true);

    const { data: inactive } = await anon()
      .from("products")
      .select("id")
      .eq("active", false)
      .limit(1);
    expect(inactive ?? []).toHaveLength(0);
  });

  it("cannot read orders, proofs, invoices, settings, audit logs, email events", async () => {
    for (const table of [
      "orders",
      "order_items",
      "payment_proofs",
      "invoices",
      "site_settings",
      "admin_audit_logs",
      "email_events",
      "rate_limits",
      "import_batches",
    ]) {
      const { data } = await anon().from(table).select("*").limit(1);
      // RLS returns an empty result set (or an error) — never data.
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("cannot write to products or payment_methods", async () => {
    const { error: insertErr } = await anon()
      .from("products")
      .insert({ sku: "HACK-1", slug: "hack", name: "hack", original_title: "hack", price: 1 });
    expect(insertErr).not.toBeNull();

    const { error: updateErr, data } = await anon()
      .from("payment_methods")
      .update({ number: "0000" })
      .eq("kind", "instapay")
      .select();
    // Either an explicit error or zero affected rows is acceptable denial.
    expect(updateErr !== null || (data ?? []).length === 0).toBe(true);
  });

  it("can read active payment methods (customers must see where to pay)", async () => {
    const { data, error } = await anon().from("payment_methods").select("number, active");
    expect(error).toBeNull();
    for (const m of data ?? []) expect(m.active).toBe(true);
  });

  it("cannot list private storage buckets' objects", async () => {
    const { data } = await anon().storage.from("payment-proofs").list();
    expect(data ?? []).toHaveLength(0);
  });
});

describe.skipIf(!configured)("RLS: authenticated customer isolation", () => {
  it("a fresh user sees no orders and only their own profile", async () => {
    const service = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const email = `rls-test-${Date.now()}@example.com`;
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: "test-password-123",
      email_confirm: true,
    });
    expect(createErr).toBeNull();

    try {
      const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
      const { error: signInErr } = await client.auth.signInWithPassword({
        email,
        password: "test-password-123",
      });
      expect(signInErr).toBeNull();

      const { data: orders } = await client.from("orders").select("id");
      expect(orders ?? []).toHaveLength(0);

      const { data: profiles } = await client.from("customer_profiles").select("user_id");
      for (const p of profiles ?? []) expect(p.user_id).toBe(created.user!.id);

      // cannot self-promote to admin
      const { error: adminErr } = await client
        .from("admin_profiles")
        .insert({ user_id: created.user!.id });
      expect(adminErr).not.toBeNull();
    } finally {
      await service.auth.admin.deleteUser(created.user!.id);
    }
  });
});
