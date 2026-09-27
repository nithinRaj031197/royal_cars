/**
 * Mandatory vs optional, derived from the schemas themselves.
 *
 * A field is mandatory if parsing an empty object reports an issue against it.
 * Conditional rules (superRefine) only run once the base object parses, so
 * those are probed separately.
 */
import { z } from "zod";
import * as S from "../src/lib/form-schemas";

const LABELS: Record<string, string> = {
  enquiryInputSchema: "Seller enquiry / acquisition — /acquisitions/new",
  inspectionInputSchema: "Inspection — /inspections/new",
  checklistItemSchema: "Inspection checklist row (nested in an inspection)",
  workOrderInputSchema: "Work order — /work/new",
  workCompletionSchema: "Work order completion — work order detail",
  accessoryInputSchema: "Accessory — vehicle detail",
  expenseInputSchema: "Expense — /vendors",
  customerInputSchema: "Customer — /leads/new (New customer)",
  leadInputSchema: "Lead — /leads/new",
  followUpInputSchema: "Follow-up — lead detail",
  testDriveInputSchema: "Test drive — lead detail",
  reservationInputSchema: "Reservation — /sales/new?type=reservation",
  saleInputSchema: "Sale — /sales/new",
  salePaymentInputSchema: "Sale payment — sale detail",
  priceChangeInputSchema: "Price change — vehicle detail",
  purchasePaymentInputSchema: "Purchase payment — acquisition detail",
  completeDeliveryInputSchema: "Delivery — sale detail",
  commitmentInputSchema: "After-sale commitment — sale detail",
  serviceRequestInputSchema: "Service request — /aftersale/new",
  serviceJobInputSchema: "Service job — service request detail",
  serviceChargeInputSchema: "Service charge — service request detail",
  settingsInputSchema: "Settings — /settings",
  staffInputSchema: "Staff account — /settings (staff)",
  signupInputSchema: "Self sign-up — /signup"
};

function unwrap(schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  let s: z.ZodTypeAny = schema;
  for (let i = 0; i < 6; i++) {
    if (s instanceof z.ZodObject) return s as z.ZodObject<z.ZodRawShape>;
    const def = (s as unknown as { _def?: { schema?: z.ZodTypeAny; innerType?: z.ZodTypeAny } })._def;
    const next = def?.schema ?? def?.innerType;
    if (!next) return null;
    s = next;
  }
  return null;
}

const rows: Array<{ form: string; field: string; required: boolean; message: string }> = [];

for (const [name, schema] of Object.entries(S)) {
  if (!name.endsWith("Schema") || typeof (schema as z.ZodTypeAny)?.safeParse !== "function") continue;
  const obj = unwrap(schema as z.ZodTypeAny);
  if (!obj) continue;
  const keys = Object.keys(obj.shape);
  const res = obj.safeParse({});
  const required = new Map<string, string>();
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !required.has(key)) required.set(key, issue.message);
    }
  }
  const form = LABELS[name] ?? name;
  for (const key of keys) {
    rows.push({ form, field: key, required: required.has(key), message: required.get(key) ?? "" });
  }
}

const byForm = new Map<string, typeof rows>();
rows.forEach((r) => byForm.set(r.form, [...(byForm.get(r.form) ?? []), r]));

console.log("| Form | Mandatory | Optional |");
console.log("|---|---|---|");
for (const [form, fields] of byForm) {
  const req = fields.filter((f) => f.required).map((f) => f.field);
  const opt = fields.filter((f) => !f.required).map((f) => f.field);
  console.log(`| ${form} | ${req.length ? req.join(", ") : "— none —"} | ${opt.length}: ${opt.join(", ")} |`);
}

console.log("\n\nMANDATORY FIELDS WITH THEIR MESSAGES\n");
for (const [form, fields] of byForm) {
  const req = fields.filter((f) => f.required);
  if (!req.length) continue;
  console.log(form);
  req.forEach((f) => console.log(`   ${f.field.padEnd(22)} ${f.message}`));
}

const total = rows.length;
const req = rows.filter((r) => r.required).length;
console.log(`\nTOTALS: ${total} fields, ${req} mandatory, ${total - req} optional`);
