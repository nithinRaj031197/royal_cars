/**
 * Reads the real spreadsheet and reports every row created by a test run,
 * resolving the id graph out from the tagged seller/vehicle.
 */
import { google } from "googleapis";
import { googleAuthConfig } from "../../src/lib/config/google-credentials";

const MARKER = /CYTEST-|CURLPROBE|LAGPROBE/;

const TABS = [
  "Sellers", "Vehicles", "AcquisitionCases", "PurchasePayments", "Inspections", "InspectionItems",
  "WorkOrders", "WorkOrderItems", "Accessories", "Expenses", "PriceHistory", "Customers", "Leads",
  "FollowUps", "TestDrives", "Reservations", "Sales", "SalePayments", "DeliveryChecklists",
  "ServiceCommitments", "ServiceRequests", "ServiceJobs", "ServiceCharges",
  "StatusHistory", "ActivityLogs", "Operations"
];

export interface Table { name: string; header: string[]; rows: string[][]; }

export async function readAll(): Promise<Map<string, Table>> {
  const auth = new google.auth.GoogleAuth(googleAuthConfig(["https://www.googleapis.com/auth/spreadsheets"]));
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
    ranges: TABS.map((t) => `'${t}'!A:ZZ`)
  });
  const out = new Map<string, Table>();
  (res.data.valueRanges ?? []).forEach((vr, i) => {
    const values = vr.values ?? [];
    out.set(TABS[i]!, { name: TABS[i]!, header: values[0] ?? [], rows: values.slice(1) });
  });
  return out;
}

const col = (t: Table, name: string) => t.header.indexOf(name);
const val = (t: Table, row: string[], name: string) => {
  const i = col(t, name);
  return i < 0 ? "" : (row[i] ?? "");
};

/** Every id belonging to the test data, reached from the tagged rows outwards. */
export function testIds(tables: Map<string, Table>): Set<string> {
  const ids = new Set<string>();
  const add = (v: string) => { if (v) ids.add(v); };

  for (const t of tables.values()) {
    for (const row of t.rows) {
      if (row.some((c) => MARKER.test(c ?? ""))) add(val(t, row, "id"));
    }
  }
  // Walk the graph until it stops growing: any row pointing at a known id is ours.
  const linkCols = ["sellerId", "vehicleId", "acquisitionCaseId", "inspectionId", "workOrderId",
    "customerId", "leadId", "saleId", "reservationId", "serviceRequestId", "entityId"];
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tables.values()) {
      for (const row of t.rows) {
        const id = val(t, row, "id");
        if (!id || ids.has(id)) continue;
        if (linkCols.some((c) => { const v = val(t, row, c); return v && ids.has(v); })) {
          ids.add(id);
          grew = true;
        }
      }
    }
  }
  return ids;
}

export function affectedRows(tables: Map<string, Table>, ids: Set<string>) {
  const report: Array<{ tab: string; rowNumber: number; id: string; summary: string }> = [];
  for (const t of tables.values()) {
    t.rows.forEach((row, i) => {
      const id = val(t, row, "id");
      const tagged = row.some((c) => MARKER.test(c ?? "")) || (id && ids.has(id));
      if (!tagged) return;
      const bits = ["stockRef", "caseRef", "name", "model", "reservationRef", "saleRef", "kind", "amountPaise", "requiredWork", "recommendedWork"]
        .map((k) => { const v = val(t, row, k); return v ? `${k}=${v}` : ""; })
        .filter(Boolean).slice(0, 3).join(" ");
      report.push({ tab: t.name, rowNumber: i + 2, id, summary: bits });
    });
  }
  return report;
}

if (process.argv[1]?.includes("verify")) {
  readAll().then((tables) => {
    const ids = testIds(tables);
    const rows = affectedRows(tables, ids);
    const byTab = new Map<string, number>();
    rows.forEach((r) => byTab.set(r.tab, (byTab.get(r.tab) ?? 0) + 1));
    console.log("TEST ROWS FOUND IN GOOGLE SHEETS");
    for (const [tab, n] of byTab) console.log(`  ${tab.padEnd(20)} ${n}`);
    console.log("\nDetail:");
    rows.forEach((r) => console.log(`  ${r.tab.padEnd(18)} row ${String(r.rowNumber).padEnd(4)} ${r.summary}`));
    console.log(`\ntotal rows: ${rows.length}`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
