import { INR } from "./config/constants";

/** All monetary amounts are stored and computed as integer paise. */
export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new Error("Invalid amount");
  return Math.round(rupees * 100);
}

/** Parse a free-form money string/number like "1,23,456.50" or "123456.5" into paise. */
export function parseMoneyToPaise(input: string | number | null | undefined): Paise | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const cleaned = input
    .replace(/[₹,\s]/g, "")
    .replace(/(inr|rs\.?)/gi, "")
    .trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function paiseToRupees(p: Paise): number {
  return p / 100;
}

/** Indian currency formatting, e.g. ₹1,23,456.50 */
export function formatINR(p: Paise | null | undefined, opts?: { includePaise?: boolean }): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  const rupees = p / 100;
  const includePaise = opts?.includePaise ?? Math.round(p) !== p;
  return new Intl.NumberFormat(INR.locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: includePaise ? 2 : 0,
    maximumFractionDigits: 2
  }).format(rupees);
}

/** Compact display for dashboards: ₹1.23L / ₹2.5Cr style. */
export function formatINRShort(p: Paise | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  const abs = Math.abs(p);
  const sign = p < 0 ? "-" : "";
  const rupees = abs / 100;
  const fmt = (v: number, suffix: string) => `${sign}₹${trimZeros(v.toFixed(2))} ${suffix}`;
  if (rupees >= 1_00_00_000) return fmt(rupees / 1_00_00_000, "Cr");
  if (rupees >= 1_00_000) return fmt(rupees / 1_00_000, "L");
  if (rupees >= 1_000) return fmt(rupees / 1_000, "K");
  return formatINR(p, { includePaise: false });
}

function trimZeros(s: string): string {
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function sumPaise(values: Array<Paise | null | undefined>): Paise {
  return values.reduce<number>((acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0), 0);
}

export function negatePaise(p: Paise): Paise {
  return -p;
}
