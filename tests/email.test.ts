import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  orderEmailHtml,
  orderEmailSubject,
  proofRejectedHtml,
  proofRejectedSubject,
} from "@/lib/email/templates";

const CONTACT = { phone: "01099019374", whatsapp: "01099019374", email: "ahmedthalool0@gmail.com" };

function args(kind: "preliminary" | "final") {
  return {
    kind,
    customerName: "Mohamed Ali",
    orderRef: "I20260713175900",
    statusLabel: kind === "preliminary" ? "Awaiting Verification" : "Paid",
    totalLabel: "EGP 30,000.00",
    paymentMethodLabel: "Instapay 01099019374",
    items: Array.from({ length: 14 }, (_, i) => ({
      name: `Product ${i + 1}`,
      qty: 2,
      amountLabel: "EGP 100.00",
    })),
    trackingUrl: "https://example.com/order/abc123",
    contact: CONTACT,
    deliveryMessage: "shipment will be delivered within 5 working days",
  };
}

describe("orderEmailHtml", () => {
  it("preliminary states verification is pending, not confirmed", () => {
    const html = orderEmailHtml(args("preliminary")).toLowerCase();
    expect(html).toContain("verif"); // verification/verified wording
    expect(html).toContain("not");
  });
  it("final confirms payment and repeats delivery message", () => {
    const html = orderEmailHtml(args("final"));
    expect(html.toLowerCase()).toContain("confirmed");
    expect(html).toContain("5 working days");
  });
  it("contains name, ref, total, tracking link; caps items at 10", () => {
    const html = orderEmailHtml(args("preliminary"));
    expect(html).toContain("Mohamed Ali");
    expect(html).toContain("I20260713175900");
    expect(html).toContain("EGP 30,000.00");
    expect(html).toContain("https://example.com/order/abc123");
    expect(html).toContain("Product 10");
    expect(html).not.toContain("Product 11");
    expect(html).toMatch(/4 more/);
  });
  it("escapes HTML in user-controlled fields (XSS)", () => {
    const a = args("final");
    a.customerName = `<script>alert(1)</script>`;
    a.items = [{ name: `<img src=x onerror=alert(1)>`, qty: 1, amountLabel: "EGP 1.00" }];
    const html = orderEmailHtml(a);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
});

describe("subjects", () => {
  it("distinguish preliminary from final", () => {
    expect(orderEmailSubject("preliminary", "I1")).not.toBe(orderEmailSubject("final", "I1"));
    expect(orderEmailSubject("preliminary", "I1").toLowerCase()).toContain("pending");
  });
  it("proof rejection subject mentions the order", () => {
    expect(proofRejectedSubject("I20260713175900")).toContain("I20260713175900");
  });
});

describe("proofRejectedHtml", () => {
  it("includes the reason (escaped) and the tracking link", () => {
    const html = proofRejectedHtml({
      customerName: "Mohamed",
      orderRef: "I1",
      reason: `<b>amount mismatch</b>`,
      trackingUrl: "https://example.com/order/tok",
      contact: CONTACT,
    });
    expect(html).toContain("amount mismatch");
    expect(html).not.toContain("<b>amount mismatch</b>");
    expect(html).toContain("https://example.com/order/tok");
  });
});

describe("brevo sendEmail (mock mode)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("mocks when EMAIL_MOCK=1 without hitting the network", async () => {
    vi.stubEnv("EMAIL_MOCK", "1");
    vi.stubEnv("EMAIL_FROM", "test@example.com");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendEmail } = await import("@/lib/email/brevo");
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Test",
      html: "<p>hi</p>",
    });
    expect(result.sent).toBe(true);
    expect(result.mocked).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("fails soft (sent:false) when the API errors — never throws", async () => {
    vi.stubEnv("EMAIL_MOCK", "0");
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "test@example.com");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network down"));
    const { sendEmail } = await import("@/lib/email/brevo");
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Test",
      html: "<p>hi</p>",
    });
    expect(result.sent).toBe(false);
    expect(result.error).toBeTruthy();
    fetchSpy.mockRestore();
  });
});
