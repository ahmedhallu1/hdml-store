import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateReceiptPdf, sanitizePdfText, type ReceiptData } from "@/lib/pdf/receipt";

const SELLER = {
  name: "Ahmed Tarek Hallul",
  taxId: "777796066",
  address: "Egypt, Damanhour, Esmail Elhaddad St, 22512",
};

/** Reproduction of the first sample receipt (total EGP 30,000.00). */
function sampleReceipt(kind: "preliminary" | "final" = "final"): ReceiptData {
  const items = [
    { description: "Silicone Phone Sticky Grip, Suction Phone Case Mount For iPhone And Android, Hands-Free Sticky Cell Phone Grip, Mobile Fidget Mirror Holder For Selfies And Videos", qty: 3, unitPricePiasters: 6600, amountPiasters: 19800 },
    { description: "2-Pack Shatterproof Camera Lens Protector For iPhone 17 Pro Max |Ar Tempered Glass Strong Adsorption Metal Camera Cover Screen(Orange)", qty: 3, unitPricePiasters: 27900, amountPiasters: 83700 },
    { description: "Wireless Mic Advance Handheld Wireless Singing Mike Multi-Function Bluetooth Karaoke Mic With Microphone Speaker For All Smart Phone (Multicolor- Colour May Vary)", qty: 3, unitPricePiasters: 19401, amountPiasters: 58203 },
    { description: "Nanlite Pavotube Ii Rgbww Led Light Tube, Color Rgbww Led Pixel Tube Photography Handheld Led Video Lighting Wand With Ac Chargers, Mounts, And Case Battery Powered (Pavotube Ii 15C 2Kit)", qty: 1, unitPricePiasters: 1399900, amountPiasters: 1399900 },
    { description: "Camelion Fast Charger Bc-1002A With 4 X Batteries Bp1 (2500mAh)", qty: 3, unitPricePiasters: 71191, amountPiasters: 213573 },
    { description: "Accessories / Service Balance", qty: 1, unitPricePiasters: 1224824, amountPiasters: 1224824 },
  ];
  return {
    orderRef: "I20260713175900",
    dateLabel: "13/07/2026",
    paymentMethodLabel: "Instapay",
    customerName: "Test Customer",
    customerPhone: "01012345678",
    seller: SELLER,
    items,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    totalPiasters: 3000000,
    deliveryMessage:
      "Thank you for ordering from us, the shipment will be delivered within 5 working days.",
    kind,
  };
}

describe("generateReceiptPdf", () => {
  it("renders the sample receipt as a valid one-page A4 PDF", async () => {
    const bytes = await generateReceiptPdf(sampleReceipt());
    expect(bytes.length).toBeGreaterThan(5000);
    // %PDF magic
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("spills onto multiple pages with many items (no clipping)", async () => {
    const base = sampleReceipt();
    const many: ReceiptData = {
      ...base,
      items: Array.from({ length: 60 }, (_, i) => ({
        description: `Bulk wholesale item number ${i + 1} with a deliberately long descriptive name that must wrap across several lines in the description column`,
        qty: 5,
        unitPricePiasters: 12345,
        amountPiasters: 61725,
      })),
      totalQty: 300,
      totalPiasters: 61725 * 60,
    };
    const doc = await PDFDocument.load(await generateReceiptPdf(many));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("survives hostile text (Arabic, emoji, huge unbroken tokens)", async () => {
    const base = sampleReceipt("preliminary");
    const hostile: ReceiptData = {
      ...base,
      customerName: "عميل تجريبي 😀",
      items: [
        {
          description: "سماعة بلوتوث " + "x".repeat(400),
          qty: 1,
          unitPricePiasters: 100000,
          amountPiasters: 100000,
        },
      ],
      totalQty: 1,
      totalPiasters: 100000,
    };
    const bytes = await generateReceiptPdf(hostile);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("differs between preliminary and final (pending-verification notice)", async () => {
    const prelim = await generateReceiptPdf(sampleReceipt("preliminary"));
    const final = await generateReceiptPdf(sampleReceipt("final"));
    // The preliminary version draws an extra notice line — the content stream
    // must differ and be longer.
    expect(prelim.length).not.toBe(final.length);
  });
});

describe("sanitizePdfText", () => {
  it("keeps Latin text and common punctuation", () => {
    expect(sanitizePdfText("Anker USB-C 30W — “Pro” Café €99")).toBe(
      "Anker USB-C 30W — “Pro” Café €99",
    );
  });
  it("replaces Arabic and emoji with ?", () => {
    expect(sanitizePdfText("سماعة")).toBe("?????");
    expect(sanitizePdfText("hi 😀 there")).toBe("hi ? there");
  });
  it("collapses whitespace", () => {
    expect(sanitizePdfText("a\n\t b   c")).toBe("a b c");
  });
});
