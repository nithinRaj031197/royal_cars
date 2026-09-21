import { INR } from "./config/constants";

export type DateOnly = string; // "YYYY-MM-DD"

export function todayISO(): string {
  return new Date().toISOString();
}

export function todayDateOnly(): DateOnly {
  return toDateOnly(new Date());
}

/** Converts a Date (any timezone) to the IST calendar date. */
export function toDateOnly(d: Date): DateOnly {
  // Use the Asia/Kolkata offset (+5:30) deterministically.
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function isValidDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export function addDays(d: DateOnly, days: number): DateOnly {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: DateOnly, b: DateOnly): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** "12 Mar 2024" in Asia/Kolkata. */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INR.locale, {
    timeZone: INR.timezone,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

/** "12 Mar 2024, 4:30 pm" in Asia/Kolkata. */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INR.locale, {
    timeZone: INR.timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export function toInputDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.length >= 10 ? d.slice(0, 10) : "";
}

export function daysHeld(from: DateOnly, to?: DateOnly): number {
  return daysBetween(from, to ?? todayDateOnly());
}

/** Parses a datetime-local input value to an ISO instant. */
export function localDateTimeToISO(value: string): string | null {
  if (!value) return null;
  // Interpret as IST (+5:30) for consistency with display timezone.
  const iso = new Date(`${value}:00+05:30`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

export function isoToLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const ist = new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}
