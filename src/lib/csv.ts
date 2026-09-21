/**
 * Minimal dependency-free CSV utilities.
 * - Preserves leading zeros by quoting cells that start with 0 or +.
 * - Escapes formula injection on export.
 */

const INJECTION_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function csvEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (INJECTION_PREFIXES.some((p) => s.startsWith(p))) {
    // Prevent spreadsheet formula evaluation on re-open.
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvEscapeCell).join(",")).join("\r\n");
}

/** Parses a CSV string. Handles quoted cells with embedded commas/newlines/quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c === "\r") {
      // skip, handled by \n
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}
