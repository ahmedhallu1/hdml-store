/**
 * Minimal RFC-4180 CSV utilities (parse + serialize with proper quoting).
 * Pure and portable (Node + Workers) — used by the admin product import/export.
 */

/** Parse CSV text into rows of string fields (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** Quote a single CSV field when needed (commas, quotes, newlines). */
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serialize one row (no trailing newline). */
export function csvRow(fields: Array<string | number | boolean | null | undefined>): string {
  return fields
    .map((f) => csvField(f === null || f === undefined ? "" : String(f)))
    .join(",");
}

/** Serialize a full table with trailing newline per row. */
export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows.map((r) => csvRow(r) + "\r\n").join("");
}
