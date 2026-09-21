"use client";

import { cn } from "@/lib/cn";

/**
 * Status tones, grouped by meaning rather than by module, so the same idea
 * always looks the same — "Completed" on a work order reads like "Delivered"
 * on a vehicle because both mean "finished well".
 */
const TONES = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  negative: "bg-red-50 text-red-700 ring-red-600/20",
  progress: "bg-blue-50 text-blue-700 ring-blue-600/20",
  waiting: "bg-amber-50 text-amber-800 ring-amber-600/20",
  done: "bg-violet-50 text-violet-700 ring-violet-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15"
} as const;

export type BadgeTone = keyof typeof TONES;

const STATUS_TONE: Record<string, BadgeTone> = {};
const assign = (tone: BadgeTone, statuses: string[]) => statuses.forEach((s) => (STATUS_TONE[s] = tone));

assign("positive", ["Acquired", "Approved", "Ready for sale", "Completed", "Fully paid", "Delivered", "Resolved", "Active", "Covered", "Won", "Pass", "Excellent", "Good"]);
assign("negative", ["Rejected", "Cancelled", "Expired", "Lost", "Critical", "Fail", "Needs repair", "Overdue", "Voided"]);
assign("progress", ["In preparation", "In progress", "Scheduled", "Booked", "Reserved", "Diagnosing", "Contacted", "Interested"]);
assign("waiting", ["Negotiating", "Evaluated", "Awaiting approval", "Reopened", "Pending", "New", "New enquiry", "Inspection scheduled", "Draft", "Open", "Average"]);
assign("done", ["Sold", "Part paid", "Converted", "Pass with findings", "Closed"]);

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const s = (status ?? "").trim();
  const tone = STATUS_TONE[s] ?? "neutral";
  return <span className={cn("badge", TONES[tone], className)}>{s || "—"}</span>;
}

