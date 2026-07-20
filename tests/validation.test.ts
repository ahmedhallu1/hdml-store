import { describe, expect, it } from "vitest";
import { normalizeEgyptMobile, waLink } from "@/lib/egypt";
import { checkoutSchema, egyptMobileSchema, parseOrErrors, registerSchema } from "@/lib/validation";

describe("normalizeEgyptMobile", () => {
  it("accepts local and international forms", () => {
    expect(normalizeEgyptMobile("01099019374")).toBe("01099019374");
    expect(normalizeEgyptMobile("+201099019374")).toBe("01099019374");
    expect(normalizeEgyptMobile("00201099019374")).toBe("01099019374");
    expect(normalizeEgyptMobile("010 9901 9374")).toBe("01099019374");
    expect(normalizeEgyptMobile("010-990-19374")).toBe("01099019374");
  });
  it("rejects invalid numbers", () => {
    expect(normalizeEgyptMobile("0109901937")).toBeNull(); // too short
    expect(normalizeEgyptMobile("01399019374")).toBeNull(); // 013 not a carrier
    expect(normalizeEgyptMobile("1234567890")).toBeNull();
    expect(normalizeEgyptMobile("")).toBeNull();
  });
  it("builds wa.me links", () => {
    expect(waLink("01099019374")).toBe("https://wa.me/201099019374");
  });
});

describe("egyptMobileSchema", () => {
  it("normalizes through zod", () => {
    expect(egyptMobileSchema.parse("+20 103 133 7325")).toBe("01031337325");
  });
  it("rejects with a friendly message", () => {
    const r = egyptMobileSchema.safeParse("12345");
    expect(r.success).toBe(false);
  });
});

// Checkout collects NO contact/delivery details anymore — just cart + method
// + optional note. Name/email come from the account; shipping comes later.
const validCheckout = {
  items: [{ productId: "6b1f8f0a-58ea-4c67-9146-95a1f6f0f8f5", qty: 3 }],
  paymentMethodId: "5f0b7a17-84a3-4b8f-a2d5-59e1cfa5f5b2",
  idempotencyKey: "0f0d8f0a-58ea-4c67-9146-95a1f6f0f8f5",
  customerNote: "Please call before delivery",
  turnstileToken: "tok",
};

describe("checkoutSchema", () => {
  it("accepts a valid payload (no contact details)", () => {
    const r = parseOrErrors(checkoutSchema, validCheckout);
    expect(r.ok).toBe(true);
  });
  it("accepts a payload with no note", () => {
    const { customerNote: _drop, ...noNote } = validCheckout;
    void _drop;
    expect(parseOrErrors(checkoutSchema, noNote).ok).toBe(true);
  });
  it("rejects empty carts, bad uuids, bad payment method and missing turnstile", () => {
    expect(parseOrErrors(checkoutSchema, { ...validCheckout, items: [] }).ok).toBe(false);
    expect(
      parseOrErrors(checkoutSchema, {
        ...validCheckout,
        items: [{ productId: "nope", qty: 1 }],
      }).ok,
    ).toBe(false);
    expect(parseOrErrors(checkoutSchema, { ...validCheckout, paymentMethodId: "nope" }).ok).toBe(
      false,
    );
    expect(parseOrErrors(checkoutSchema, { ...validCheckout, turnstileToken: "" }).ok).toBe(false);
  });
  it("rejects fractional and zero quantities", () => {
    expect(
      parseOrErrors(checkoutSchema, {
        ...validCheckout,
        items: [{ productId: validCheckout.items[0].productId, qty: 0 }],
      }).ok,
    ).toBe(false);
    expect(
      parseOrErrors(checkoutSchema, {
        ...validCheckout,
        items: [{ productId: validCheckout.items[0].productId, qty: 1.5 }],
      }).ok,
    ).toBe(false);
  });
});

describe("registerSchema", () => {
  it("normalizes email casing", () => {
    const r = registerSchema.safeParse({
      fullName: "Test User",
      email: "USER@Example.COM",
      phone: "01012345678",
      password: "supersecret",
      turnstileToken: "tok",
    });
    expect(r.success && r.data.email).toBe("user@example.com");
  });
  it("enforces password length", () => {
    const r = registerSchema.safeParse({
      fullName: "Test User",
      email: "user@example.com",
      phone: "01012345678",
      password: "short",
      turnstileToken: "tok",
    });
    expect(r.success).toBe(false);
  });
});
