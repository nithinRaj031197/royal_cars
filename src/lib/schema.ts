import { z } from "zod";
import { parseMoneyToPaise } from "./money";
import { isValidDateOnly } from "./dates";

/** Money fields accept "123456.78", "1,23,456" or numbers; stored as integer paise. */
export const moneyInput = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const p = parseMoneyToPaise(v);
    if (p === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid amount in rupees" });
      return z.NEVER;
    }
    return p;
  });

export const optionalMoneyInput = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : parseMoneyToPaise(v)));

export const dateOnly = z
  .string()
  .refine((v) => isValidDateOnly(v), { message: "Enter a valid date (YYYY-MM-DD)" });

export const optionalDateOnly = z
  .string()
  .optional()
  .transform((v) => (v && isValidDateOnly(v) ? v : ""));

/** Phone numbers kept as text to preserve leading zeros and +91 formats. */
export const phone = z
  .string()
  .trim()
  .regex(/^[+0-9][0-9\s-]{5,17}$/, "Enter a valid phone number");

export const optionalPhone = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => v ?? "");

/**
 * Optional email that genuinely accepts "blank".
 *
 * `z.string().email().optional().default("")` looks right but rejects BOTH ""
 * and undefined: the default supplies "", which then fails the email check, so
 * the field can never be left empty. Validate the email only when one is given.
 */
export const optionalEmail = z
  .union([z.string().email("Enter a valid email"), z.literal("")])
  .optional()
  .transform((v) => v ?? "");

/**
 * Lenient inputs for migrating existing records.
 *
 * The showroom is entering history it already has on paper, and that history is
 * incomplete — a car bought years ago may have no VIN recorded, a walk-in seller
 * no phone number. Blocking the save loses the data entirely, which is worse
 * than storing a partial record, so descriptive fields accept blanks and only
 * validate what was actually provided.
 *
 * Structural fields (which vehicle, which sale, how much a payment was) stay
 * required: those are what keep records linked and balances correct.
 */
export const optionalText = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === null ? "" : String(v).trim()));

/** A phone if one is given; blank is fine. Format is not policed - staff paste
 *  numbers in many shapes and a rejected form loses the record. */
export const looseOptionalPhone = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === null ? "" : String(v).trim()));

/** Whole number within a range, or blank. Returns undefined when not provided. */
export function optionalWholeNumber(min: number, max: number, label: string) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null || String(v).trim() === "") return undefined;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });
}

/** Shared enum lists. */
export const ACQ_STATUSES = [
  "New enquiry",
  "Inspection scheduled",
  "Evaluated",
  "Negotiating",
  "Approved",
  "Acquired",
  "Rejected",
  "Cancelled"
] as const;

export const INSPECTION_TYPES = ["Pre-purchase", "Receiving", "Post-repair", "Pre-delivery", "After-sale"] as const;

export const INSPECTION_RESULTS = ["Pass", "Pass with findings", "Fail", "Not completed"] as const;

export const CONDITIONS = ["Excellent", "Good", "Average", "Needs repair", "Critical", "Not inspected"] as const;

export const HISTORY_STATES = ["Unknown", "Reported", "Verified", "None"] as const;

export const CHECKLIST_AREAS = [
  "Exterior", "Interior", "Engine", "Transmission", "Tyres", "Battery", "AC",
  "Electrical", "Suspension", "Brakes", "Lights", "Underbody", "Leaks",
  "Test drive", "Documents"
] as const;

export const WORK_STAGES = ["Pre-purchase", "Inventory preparation", "Pre-delivery", "After-sale"] as const;

export const WORK_STATUSES = ["Draft", "Approved", "In progress", "Completed", "Cancelled"] as const;

export const PAYER_OPTIONS = ["Showroom", "Seller", "Customer", "Other"] as const;

export const EXPENSE_CATEGORIES = [
  "Transportation", "Insurance", "Documentation", "Parking", "Advertising",
  "Inspection fee", "Accessories", "Repair", "Miscellaneous"
] as const;

export const LEAD_SOURCES = [
  "Walk-in", "Phone", "Website", "Referral", "Social media", "Newspaper", "OLX/Portals", "Other"
] as const;

export const LEAD_STATUSES = ["New", "Contacted", "Interested", "Test drive scheduled", "Negotiating", "Won", "Lost", "Dormant"] as const;

export const PAYMENT_METHODS = ["Cash", "UPI", "NEFT/RTGS", "Cheque", "Card", "Other"] as const;

export const PAYMENT_KINDS = ["Booking", "Part payment", "Final payment", "Refund", "Adjustment"] as const;

export const SALE_STATUSES = ["Booked", "Part paid", "Fully paid", "Delivered", "Completed", "Cancelled"] as const;

export const RESERVATION_STATUSES = ["Active", "Converted", "Cancelled", "Expired"] as const;

export const SERVICE_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

export const SERVICE_STATUSES = [
  "Open", "Scheduled", "Diagnosing", "Awaiting approval", "In progress", "Resolved", "Closed", "Cancelled", "Reopened"
] as const;

export const VEHICLE_STATES = [
  "In acquisition pipeline",
  "In preparation",
  "Ready for sale",
  "Reserved",
  "Sold",
  "Delivered",
  "Archived"
] as const;

export const PUBLICATION_STATES = ["Not published", "Approved for website", "Published", "Unpublished"] as const;

export const VENDOR_CATEGORIES = [
  "Workshop", "Body shop", "Denting painting", "Electrical", "Tyres", "AC",
  "Detailing", "Accessories", "Insurance", "RTO agent", "Other"
] as const;

export const DELIVERY_ITEM_KINDS = [
  "Final inspection", "Promised repairs", "Cleaning & preparation", "Keys & accessories",
  "Required documents", "Payment review", "Handover acknowledgement"
] as const;
