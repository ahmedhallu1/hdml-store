/**
 * HDML receipt PDF generator — PURE (no supabase / server imports) so it can
 * be unit-tested in isolation. Recreates the visual language of HDML's
 * existing receipts: A4, Helvetica, teal accents, logo top-left, seller block
 * top-right, wrapped items table with multi-page support.
 *
 * All monetary values are integer piasters (see src/lib/money.ts).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { piastersToDisplay } from "@/lib/money";
import { HDML_LOGO_PNG_BASE64 } from "./logo-data";

export interface ReceiptData {
  orderRef: string;
  dateLabel: string;
  paymentMethodLabel: string;
  customerName?: string;
  customerPhone?: string;
  seller: { name: string; taxId: string; address: string };
  items: Array<{
    description: string;
    qty: number;
    unitPricePiasters: number;
    amountPiasters: number;
  }>;
  totalQty: number;
  totalPiasters: number;
  deliveryMessage: string;
  kind: "preliminary" | "final";
}

// ---------------------------------------------------------------------------
// Layout constants (points)
// ---------------------------------------------------------------------------

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 48;
const RIGHT_EDGE = PAGE_W - MARGIN; // ≈ 547.28
const BOTTOM_LIMIT = 90; // never draw a row below this

// Items table columns.
const COL_DESC_X = MARGIN; // description, left-aligned
const COL_DESC_W = 300; // wrap width for descriptions
const COL_QTY_RIGHT = 400; // quantity, right-aligned ending here
const COL_UNIT_RIGHT = 470; // unit price, right-aligned ending here
const COL_AMOUNT_RIGHT = RIGHT_EDGE; // amount, right-aligned ending here

// Colors.
const TEAL = rgb(0, 0.278, 0.329); // HDML brand teal (#004754)
const INK = rgb(0.122, 0.161, 0.216); // gray-800 (#1f2937)
const BODY = rgb(0.15, 0.17, 0.21);
const HAIRLINE = rgb(0.88, 0.88, 0.88);
const AMBER = rgb(0.706, 0.325, 0.035); // amber-700 — visible warning on white

// ---------------------------------------------------------------------------
// WinAnsi text safety
// ---------------------------------------------------------------------------

/**
 * Characters the standard Helvetica fonts (WinAnsi encoding) can draw:
 * ASCII printables, Latin-1 printables, plus the Windows-1252 extras that
 * WinAnsi maps into 0x80–0x9F (curly quotes, dashes, ellipsis, euro, …).
 */
const WINANSI_SAFE =
  /[\u0020-\u007E\u00A0-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/u;

/**
 * Make arbitrary text safe for pdf-lib's Helvetica (WinAnsi): collapse
 * whitespace and replace every character the encoding cannot represent
 * (Arabic, emoji, control chars, …) with "?". Applied to ALL drawn text.
 */
export function sanitizePdfText(s: string): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of collapsed) out += WINANSI_SAFE.test(ch) ? ch : "?";
  return out;
}

// ---------------------------------------------------------------------------
// Text measurement helpers
// ---------------------------------------------------------------------------

/**
 * Wrap sanitized text to `maxWidth` using real font metrics. Breaks on
 * spaces; tokens wider than the column are hard-broken mid-token so nothing
 * can ever overflow into the next column.
 */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const width = (t: string) => font.widthOfTextAtSize(t, size);
  const lines: string[] = [];
  let current = "";

  for (let word of text.split(" ").filter(Boolean)) {
    // Hard-break very long tokens (URLs, part numbers…).
    while (width(word) > maxWidth) {
      let cut = word.length;
      while (cut > 1 && width(word.slice(0, cut)) > maxWidth) cut--;
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitizePdfText(`HDML Receipt ${data.orderRef}`));
  doc.setProducer("HDML Store");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(HDML_LOGO_PNG_BASE64);

  /** Add a page with an explicit white background (viewers default to white,
   *  but rasterizers/thumbnailers render undrawn areas transparent). */
  const addWhitePage = (): PDFPage => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });
    return p;
  };

  let page: PDFPage = addWhitePage();
  let y = PAGE_H - MARGIN; // running cursor: top of the next thing to draw

  const drawLeft = (t: string, x: number, baseline: number, size: number, f: PDFFont, color = BODY) => {
    page.drawText(sanitizePdfText(t), { x, y: baseline, size, font: f, color });
  };
  const drawRight = (t: string, rightX: number, baseline: number, size: number, f: PDFFont, color = BODY) => {
    const s = sanitizePdfText(t);
    page.drawText(s, { x: rightX - f.widthOfTextAtSize(s, size), y: baseline, size, font: f, color });
  };
  const hLine = (atY: number, thickness: number, color = HAIRLINE) => {
    page.drawLine({ start: { x: MARGIN, y: atY }, end: { x: RIGHT_EDGE, y: atY }, thickness, color });
  };

  /** Items table header (redrawn at the top of every continuation page). */
  const drawTableHeader = () => {
    const baseline = y - 10;
    drawLeft("Description", COL_DESC_X, baseline, 9.5, bold, INK);
    drawRight("Quantity", COL_QTY_RIGHT, baseline, 9.5, bold, INK);
    drawRight("Unit Price", COL_UNIT_RIGHT, baseline, 9.5, bold, INK);
    drawRight("Amount", COL_AMOUNT_RIGHT, baseline, 9.5, bold, INK);
    hLine(y - 15, 1, TEAL);
    y -= 24;
  };

  /** Start a continuation page; redraw the table header when mid-table. */
  const newPage = (inTable: boolean) => {
    page = addWhitePage();
    y = PAGE_H - MARGIN;
    if (inTable) drawTableHeader();
  };

  // ---- Header: logo top-left, seller block top-right ----------------------

  // The 500x500 PNG carries generous whitespace around the wordmark, so a
  // 90pt box slightly outdented left reads as a clean top-left wordmark.
  const logoSize = 90;
  const logoBottom = PAGE_H - 26 - logoSize;
  page.drawImage(logo, { x: MARGIN - 10, y: logoBottom, width: logoSize, height: logoSize });

  let sellerBaseline = PAGE_H - MARGIN - 9;
  drawRight(`Seller: ${data.seller.name}`, RIGHT_EDGE, sellerBaseline, 9, font, INK);
  sellerBaseline -= 12;
  drawRight(`Tax ID: ${data.seller.taxId}`, RIGHT_EDGE, sellerBaseline, 9, font, INK);
  sellerBaseline -= 12;
  for (const line of wrapText(sanitizePdfText(`Address: ${data.seller.address}`), font, 9, 200)) {
    drawRight(line, RIGHT_EDGE, sellerBaseline, 9, font, INK);
    sellerBaseline -= 12;
  }

  // Continue below whichever header element reaches lower.
  y = Math.min(logoBottom, sellerBaseline + 12) - 22;

  // ---- Title + meta --------------------------------------------------------

  drawLeft("Order Receipt", MARGIN, y - 18, 18, bold, TEAL);
  y -= 18 + 10;

  if (data.kind === "preliminary") {
    drawLeft("PRELIMINARY RECEIPT — PAYMENT PENDING VERIFICATION", MARGIN, y - 10, 10, bold, AMBER);
    y -= 18;
  }

  const metaLines: string[] = [
    `Order ID: ${data.orderRef}`,
    `Date: ${data.dateLabel}`,
    `Payment method: ${data.paymentMethodLabel}`,
  ];
  if (data.customerName) {
    metaLines.push(
      `Customer: ${data.customerName}${data.customerPhone ? ` — ${data.customerPhone}` : ""}`,
    );
  }
  for (const line of metaLines) {
    drawLeft(line, MARGIN, y - 10, 10, font, BODY);
    y -= 14;
  }
  y -= 10;

  // ---- Items table ---------------------------------------------------------

  drawTableHeader();

  for (const item of data.items) {
    const descLines = wrapText(sanitizePdfText(item.description), font, 9, COL_DESC_W);
    const rowHeight = descLines.length * 11 + 8;
    if (y - rowHeight < BOTTOM_LIMIT) newPage(true);

    let baseline = y - 9;
    for (const line of descLines) {
      drawLeft(line, COL_DESC_X, baseline, 9, font, BODY);
      baseline -= 11;
    }
    // Numeric columns sit on the row's first baseline.
    drawRight(String(item.qty), COL_QTY_RIGHT, y - 9, 9, font, BODY);
    drawRight(piastersToDisplay(item.unitPricePiasters), COL_UNIT_RIGHT, y - 9, 9, font, BODY);
    drawRight(piastersToDisplay(item.amountPiasters), COL_AMOUNT_RIGHT, y - 9, 9, font, BODY);

    hLine(y - rowHeight + 3, 0.5, HAIRLINE);
    y -= rowHeight;
  }

  // ---- Total row -----------------------------------------------------------

  const totalRowHeight = 26;
  if (y - totalRowHeight < BOTTOM_LIMIT) newPage(true);
  hLine(y - 1, 1.2, TEAL); // heavier divider above the total
  const totalBaseline = y - 17;
  drawLeft("Total", COL_DESC_X, totalBaseline, 10, bold, INK);
  drawRight(String(data.totalQty), COL_QTY_RIGHT, totalBaseline, 10, bold, INK);
  drawRight(`${piastersToDisplay(data.totalPiasters)} EGP`, COL_AMOUNT_RIGHT, totalBaseline, 10, bold, INK);
  y -= totalRowHeight;

  // ---- Footer: payment communication + delivery message --------------------

  y -= 14;
  const footerWidth = RIGHT_EDGE - MARGIN;

  const payLines = wrapText(
    sanitizePdfText(`Please use the following communication for your payment: ${data.orderRef}`),
    bold,
    10,
    footerWidth,
  );
  for (const line of payLines) {
    if (y - 14 < BOTTOM_LIMIT) newPage(false);
    drawLeft(line, MARGIN, y - 10, 10, bold, INK);
    y -= 14;
  }

  y -= 4;
  for (const line of wrapText(sanitizePdfText(data.deliveryMessage), font, 10, footerWidth)) {
    if (y - 14 < BOTTOM_LIMIT) newPage(false);
    drawLeft(line, MARGIN, y - 10, 10, font, BODY);
    y -= 14;
  }

  return doc.save();
}
