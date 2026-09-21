"use client";

import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";

/** Renders paise as Indian currency, with figures aligned for tables. */
export function Money({ paise, className }: { paise: string | number | null | undefined; className?: string }) {
  const n = typeof paise === "string" ? Number(paise) : paise;
  return <span className={`tabular ${className ?? ""}`}>{formatINR(Number.isFinite(n) ? n : null)}</span>;
}

export function DateText({ value, time }: { value?: string | null; time?: boolean }) {
  return <span className="tabular">{time ? formatDateTime(value) : formatDate(value)}</span>;
}

/** A human-readable reference such as STK-00001 or SAL-00012. */
export function Ref({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`ref text-[0.95em] ${className ?? ""}`}>{children}</span>;
}
