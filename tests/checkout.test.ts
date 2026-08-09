/**
 * Integration tests for placeOrder with a scripted fake Supabase service
 * client: verifies server-side re-pricing, MOQ, minimum order, idempotency,
 * tier pricing, availability checks and order_ref collision retries — without
 * a database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── mutable test doubles (hoisted for vi.mock factories) ───────────────────
const H = vi.hoisted(() => ({
  turnstileOk: true,
  rateLimitOk: true,
  acceptingOrders: true as boolean,
  /** FIFO of query results, consumed by each awaited supabase call in order. */
  queue: [] as Array<{ data?: unknown; error?: { code?: string; message: string } | null }>,
  /** Recorded calls: { table, ops: [method, args][] } in execution order. */
  calls: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ id: "user-1", email: "buyer@example.com" }),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: async () => H.turnstileOk,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => H.rateLimitOk,
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@/lib/settings", () => ({
  getSiteSettings: async () => ({
    ordering: {
      min_order_egp: 1000,
      currency: "EGP",
      vat_note: "",
      accepting_orders: H.acceptingOrders,
      paused_note: "",
    },
    seller_info: {}, delivery: {}, contact: {}, branding: {},
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseService: () => ({
    from(table: string) {
      const record = { table, ops: [] as Array<[string, unknown[]]> };
      const finish = () => {
        H.calls.push(record);
        return Promise.resolve(H.queue.shift() ?? { data: null, error: null });
      };
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "insert", "delete", "update", "order", "limit"]) {
        builder[m] = (...args: unknown[]) => {
          record.ops.push([m, args]);
          return builder;
        };
      }
      builder.maybeSingle = finish;
      builder.single = finish;
      builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        finish().then(res, rej);
      return builder;
    },
  }),
}));

import { placeOrder } from "@/server/actions/checkout";

// ─── fixtures ────────────────────────────────────────────────────────────────
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const METHOD = "33333333-3333-4333-8333-333333333333";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: P1,
    name: "Anker USB-C Charger 30W",
    sku: "HDML-AAAAAAAA",
    price: 500, // EGP 500.00 — authoritative DB price
    moq: 1,
    stock_status: "confirm_availability",
    active: true,
    product_price_tiers: [],
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: P1, qty: 3 }],
    paymentMethodId: METHOD,
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
    customerNote: "Please call before delivery",
    turnstileToken: "tok",
    ...overrides,
  };
}

const noExisting = { data: null, error: null };
const methodRow = {
  data: { id: METHOD, label: "Instapay", number: "01099019374", active: true, min_order_egp: 0 },
  error: null,
};
// placeOrder reads the profile name right after validating the payment method.
const profileRow = { data: { full_name: "Mohamed Ali" }, error: null };
const insertedOrder = {
  data: { id: "order-1", tracking_token: "a".repeat(48) },
  error: null,
};
const ok = { data: null, error: null };

function findInsert(table: string) {
  return H.calls.find((c) => c.table === table && c.ops.some(([m]) => m === "insert"));
}
function insertPayload(table: string): Record<string, unknown> {
  const call = findInsert(table);
  const op = call?.ops.find(([m]) => m === "insert");
  return (op?.[1][0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  H.turnstileOk = true;
  H.rateLimitOk = true;
  H.acceptingOrders = true;
  H.queue.length = 0;
  H.calls.length = 0;
});

// ─── tests ───────────────────────────────────────────────────────────────────
describe("placeOrder", () => {
  it("creates an order priced from the DB (client prices are irrelevant)", async () => {
    H.queue.push(
      noExisting,
      { data: [productRow()], error: null },
      methodRow,
      profileRow,
      insertedOrder,
      ok, // items
      ok, // history
    );
    const result = await placeOrder(input());
    expect(result).toEqual({ trackingToken: "a".repeat(48) });

    const order = insertPayload("orders");
    expect(order.subtotal).toBe("1500.00"); // 3 × EGP 500 from the DB
    expect(order.total).toBe("1500.00");
    expect(order.adjustment_total).toBe("0");
    expect(order.payment_method_label).toBe("Instapay 01099019374");
    expect(order.status).toBe("awaiting_payment");

    const items = findInsert("order_items")!.ops.find(([m]) => m === "insert")![1][0] as Array<
      Record<string, unknown>
    >;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      unit_price: "500.00",
      qty: 3,
      amount: "1500.00",
      name_snapshot: "Anker USB-C Charger 30W",
      sku_snapshot: "HDML-AAAAAAAA",
      is_custom: false,
    });
  });

  it("applies wholesale tier pricing", async () => {
    H.queue.push(
      noExisting,
      {
        data: [
          productRow({
            product_price_tiers: [
              { min_qty: 10, unit_price: 400 },
              { min_qty: 50, unit_price: 350 },
            ],
          }),
        ],
        error: null,
      },
      methodRow,
      profileRow,
      insertedOrder,
      ok,
      ok,
    );
    const result = await placeOrder(input({ items: [{ productId: P1, qty: 10 }] }));
    expect("trackingToken" in result).toBe(true);
    expect(insertPayload("orders").subtotal).toBe("4000.00"); // 10 × 400 tier
  });

  it("enforces per-product MOQ", async () => {
    H.queue.push(noExisting, { data: [productRow({ moq: 5 })], error: null });
    const result = await placeOrder(input({ items: [{ productId: P1, qty: 3 }] }));
    expect(result).toMatchObject({ error: expect.stringContaining("minimum order quantity of 5") });
    expect(findInsert("orders")).toBeUndefined();
  });

  it("refuses every order while the ordering switch is off", async () => {
    H.acceptingOrders = false;
    H.queue.push(noExisting, { data: [productRow()], error: null });

    const result = await placeOrder(input({ items: [{ productId: P1, qty: 10 }] }));

    expect(result).toEqual({
      error:
        "Ordering is stopped right now. Your cart is saved — ask us to notify you when we reopen.",
    });
    // Nothing was written: the guard sits before the order insert.
    expect(H.calls.some((c) => c.table === "orders" && c.ops.some(([m]) => m === "insert"))).toBe(
      false,
    );
  });

  it("enforces the EGP 1,000 minimum order", async () => {
    H.queue.push(noExisting, { data: [productRow({ price: 100 })], error: null });
    const result = await placeOrder(input({ items: [{ productId: P1, qty: 3 }] })); // EGP 300
    expect(result).toMatchObject({ error: expect.stringContaining("minimum order is EGP 1,000.00") });
  });

  it("is idempotent: an existing order for the key short-circuits", async () => {
    H.queue.push({ data: { tracking_token: "b".repeat(48) }, error: null });
    const result = await placeOrder(input());
    expect(result).toEqual({ trackingToken: "b".repeat(48) });
    expect(H.calls).toHaveLength(1); // nothing else touched
  });

  it("rejects inactive and out-of-stock products", async () => {
    H.queue.push(noExisting, { data: [productRow({ active: false })], error: null });
    expect(await placeOrder(input())).toMatchObject({
      error: expect.stringContaining("no longer available"),
    });

    H.queue.length = 0;
    H.calls.length = 0;
    H.queue.push(noExisting, {
      data: [productRow({ stock_status: "out_of_stock" })],
      error: null,
    });
    expect(await placeOrder(input())).toMatchObject({
      error: expect.stringContaining("no longer available"),
    });
  });

  it("rejects items missing from the DB", async () => {
    H.queue.push(noExisting, { data: [productRow()], error: null });
    const result = await placeOrder(
      input({ items: [{ productId: P1, qty: 2 }, { productId: P2, qty: 2 }] }),
    );
    expect("error" in result).toBe(true);
  });

  it("retries the order_ref on 23505 collisions with a bumped timestamp", async () => {
    H.queue.push(
      noExisting,
      { data: [productRow()], error: null },
      methodRow,
      profileRow,
      { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"orders_order_ref_key\"" } },
      insertedOrder,
      ok,
      ok,
    );
    const result = await placeOrder(input());
    expect(result).toEqual({ trackingToken: "a".repeat(48) });
    const orderInserts = H.calls.filter(
      (c) => c.table === "orders" && c.ops.some(([m]) => m === "insert"),
    );
    expect(orderInserts).toHaveLength(2);
    const refs = orderInserts.map(
      (c) => (c.ops.find(([m]) => m === "insert")![1][0] as { order_ref: string }).order_ref,
    );
    expect(refs[0]).not.toBe(refs[1]); // bumped second attempt
  });

  it("cleans up the order when items insert fails (no half-written orders)", async () => {
    H.queue.push(
      noExisting,
      { data: [productRow()], error: null },
      methodRow,
      profileRow,
      insertedOrder,
      { data: null, error: { message: "boom" } }, // items insert fails
      ok, // compensating delete
    );
    const result = await placeOrder(input());
    expect("error" in result).toBe(true);
    const deleteCall = H.calls.find(
      (c) => c.table === "orders" && c.ops.some(([m]) => m === "delete"),
    );
    expect(deleteCall).toBeDefined();
  });

  it("fails closed on Turnstile and validation errors", async () => {
    H.turnstileOk = false;
    expect(await placeOrder(input())).toMatchObject({
      error: expect.stringContaining("verification"),
    });

    H.turnstileOk = true;
    expect(await placeOrder(input({ items: [] }))).toMatchObject({ error: expect.any(String) });
    expect(await placeOrder(input({ paymentMethodId: "not-a-uuid" }))).toMatchObject({
      error: expect.any(String),
    });
  });

  it("rejects a payment method whose order minimum the cart does not meet", async () => {
    // Bank transfer requires EGP 70,000; a 3 × EGP 500 = EGP 1,500 cart cannot use it.
    H.queue.push(
      noExisting,
      { data: [productRow()], error: null },
      {
        data: {
          id: METHOD,
          label: "Bank transfer (CIB)",
          number: "100070715613",
          active: true,
          min_order_egp: 70000,
        },
        error: null,
      },
    );
    const result = await placeOrder(input());
    expect(result).toMatchObject({
      error: expect.stringContaining("only available for orders of"),
    });
    expect(findInsert("orders")).toBeUndefined();
  });
});
