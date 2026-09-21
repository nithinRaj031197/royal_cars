/**
 * Regenerates DATA_DICTIONARY.md from the schema registry so the document can
 * never drift from the tabs the app actually reads and writes.
 *
 * Usage: pnpm schema:export
 */
import { writeFileSync } from "node:fs";
import { TABLES } from "../src/lib/store/tables";
import { SCHEMA_VERSION } from "../src/lib/config/constants";
import { REF_PREFIXES } from "../src/lib/ids";

const BASE = ["id", "createdAt", "updatedAt", "version", "operationId", "createdBy", "updatedBy", "archived"];

/** Short notes for columns whose meaning is not obvious from the name. */
const NOTES: Record<string, string> = {
  amountPaise: "Integer paise. Never a float.",
  purchasePricePaise: "Agreed purchase price. Confidential — hidden without purchase.view.",
  minimumPricePaise: "Floor price. Confidential — hidden without profit.view.",
  askingPricePaise: "Initial asking price (set once; also seeds currentAskingPaise).",
  currentAskingPaise: "Current listed price; changed only via the price-change workflow.",
  finalSalePricePaise: "Final net sale price once sold.",
  snapshotInvestmentPaise: "Investment frozen at sale time for historical reporting.",
  snapshotGrossProfitPaise: "Gross vehicle profit at sale time. Not business net profit.",
  lifecycleState: "Inventory/sale dimension. Separate from acquisition status and publication state.",
  publicationState: "Future public-website dimension. Not used to gate admin behaviour.",
  voidedAt: "Set when reversed. Voided rows stay; balances exclude them.",
  reversesPaymentId: "Points at the payment this record reverses.",
  workOrderId: "When set, the cost sits inside that work order's invoice and is NOT counted again.",
  payer: "Showroom | Seller | Customer | Other. Only Showroom-paid amounts enter investment.",
  itemsJson: "JSON array of delivery checklist items (kind, label, mandatory, done, note).",
  errorsJson: "JSON array of {row, message} for the import batch.",
  detailsJson: "JSON blob of changed fields. Never stores identity documents or secrets.",
  operationId: "Operation that produced this write; used for retry-safety and reconciliation.",
  archived: "Soft delete. Financial records use void/reversal instead.",
  version: "Incremented on every write; a mismatched version rejects the edit as stale.",
  customerChargePaise: "Approved amount the customer is billed for after-sale work.",
  accidentHistory: "Unknown | Reported | Verified | None. Missing data is never treated as 'None'.",
  floodHistory: "Unknown | Reported | Verified | None. Missing data is never treated as 'None'."
};

const PURPOSE: Record<string, string> = {
  Staff: "Sign-in allowlist and role assignment. Never stores passwords or tokens.",
  Sellers: "People the showroom buys from.",
  Vehicles: "One row per vehicle identity, from first enquiry through after-sale.",
  AcquisitionCases: "One purchase attempt for a vehicle. A re-acquired vehicle gets a new case.",
  PurchasePayments: "Money paid to the seller. Settles purchase liability; never an expense.",
  Inspections: "Pre-purchase, receiving, post-repair, pre-delivery and after-sale inspections.",
  InspectionItems: "Per-area checklist findings for one inspection.",
  Vendors: "Workshops, body shops and suppliers.",
  WorkOrders: "Repair/refurbishment jobs. Only completed, showroom-paid actuals enter investment.",
  WorkOrderItems: "Line items within a work order (informational; the invoice total is canonical).",
  Accessories: "Fitted accessories. Linked to a work order means already billed there.",
  Expenses: "Other vehicle costs. Repair/Accessories categories are excluded from 'other'.",
  VehiclePhotos: "Gallery and inspection-evidence images stored in Drive.",
  VehicleDocuments: "RC, insurance, invoices and identity documents stored in Drive.",
  PriceHistory: "Append-only record of every price change with reason and actor.",
  Customers: "Buyers and enquirers.",
  Leads: "Buyer interest in a vehicle.",
  FollowUps: "Dated follow-up tasks; drives the overdue counters.",
  TestDrives: "Test-drive appointments and outcomes.",
  Reservations: "Bookings. Only one Active reservation per vehicle at a time.",
  Sales: "Confirmed sales with a financial snapshot taken at sale time.",
  SalePayments: "Customer receipts and refunds. Void/reversal, never deletion.",
  DeliveryChecklists: "Handover checklist, including any approved outstanding-balance exception.",
  ServiceCommitments: "What was promised at sale (free service, promised repair, coverage).",
  ServiceRequests: "After-sale complaints and their coverage decisions.",
  ServiceJobs: "Work performed against a service request.",
  ServiceCharges: "Customer-billable service money, separate from the sale balance.",
  StatusHistory: "Every state transition with reason and actor.",
  ActivityLogs: "Append-only audit trail of significant actions.",
  Settings: "Showroom configuration and reference counters (id = key).",
  ImportBatches: "CSV import history with per-row errors, for safe retry.",
  Operations: "Critical-write operation records for idempotency and reconciliation."
};

function main() {
  const lines: string[] = [];
  lines.push("# Data dictionary");
  lines.push("");
  lines.push(`Schema version **${SCHEMA_VERSION}** · ${Object.keys(TABLES).length} application-managed tabs.`);
  lines.push("");
  lines.push("> Generated by `pnpm schema:export` from `src/lib/store/tables.ts`. Do not edit by hand —");
  lines.push("> that file is the single source of truth, and the store validates every tab against it.");
  lines.push("");
  lines.push("## Conventions");
  lines.push("");
  lines.push("- **Money** is stored as integer **paise** in `*Paise` columns. `₹1,234.50` is `123450`.");
  lines.push("- **Timestamps** (`createdAt`, `updatedAt`, `*At`) are ISO-8601 UTC strings.");
  lines.push("- **Business dates** (`date`, `*Date`, `*On`) are date-only `YYYY-MM-DD` in Asia/Kolkata.");
  lines.push("- **Booleans** are the strings `TRUE` / `FALSE`.");
  lines.push("- **Identifiers** are UUIDs. Row numbers are never identifiers.");
  lines.push("- **Phone numbers and references** are text, preserving leading zeros.");
  lines.push("");
  lines.push("Every tab begins with the same eight audit columns:");
  lines.push("");
  lines.push("| Column | Meaning |");
  lines.push("| --- | --- |");
  for (const c of BASE) lines.push(`| \`${c}\` | ${NOTES[c] ?? baseNote(c)} |`);
  lines.push("");
  lines.push("## Human-readable reference prefixes");
  lines.push("");
  lines.push("| Prefix | Used for |");
  lines.push("| --- | --- |");
  for (const [k, v] of Object.entries(REF_PREFIXES)) lines.push(`| \`${v}-00001\` | ${k} |`);
  lines.push("");
  lines.push("Counters live in the `Settings` tab under `ref:<PREFIX>` and survive restarts.");
  lines.push("");
  lines.push("## Tabs");
  lines.push("");

  for (const [name, def] of Object.entries(TABLES)) {
    const specific = def.columns.filter((c) => !BASE.includes(c));
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(PURPOSE[name] ?? "");
    lines.push("");
    lines.push(`${def.columns.length} columns (8 audit + ${specific.length} specific).`);
    lines.push("");
    lines.push("| # | Column | Notes |");
    lines.push("| --- | --- | --- |");
    specific.forEach((c, i) => {
      lines.push(`| ${i + 9} | \`${c}\` | ${NOTES[c] ?? ""} |`);
    });
    lines.push("");
  }

  writeFileSync("docs/DATA_DICTIONARY.md", lines.join("\n"));
  console.log(`Wrote docs/DATA_DICTIONARY.md (${Object.keys(TABLES).length} tabs, schema v${SCHEMA_VERSION}).`);
}

function baseNote(c: string): string {
  switch (c) {
    case "id": return "UUID primary key. Stable for the life of the record.";
    case "createdAt": return "ISO timestamp of creation.";
    case "updatedAt": return "ISO timestamp of the last write.";
    case "createdBy": return "Email of the staff member who created the row.";
    case "updatedBy": return "Email of the staff member who last wrote the row.";
    default: return "";
  }
}

main();
