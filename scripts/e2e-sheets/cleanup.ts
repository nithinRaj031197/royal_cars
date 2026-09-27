/**
 * Removes exactly the rows a Sheets test run created, and nothing else.
 *
 * Rows are identified by the run marker or by being reachable from a marked
 * row through an id reference. Deletion runs per tab in descending row order,
 * because deleting a row shifts every row beneath it.
 *
 *   npx tsx scripts/e2e-sheets/cleanup.ts          # dry run, prints the plan
 *   npx tsx scripts/e2e-sheets/cleanup.ts --apply  # performs the deletion
 */
import { google } from "googleapis";
import { googleAuthConfig } from "../../src/lib/config/google-credentials";
import { readAll, testIds, affectedRows } from "./verify";

async function main() {
  const apply = process.argv.includes("--apply");
  const auth = new google.auth.GoogleAuth(googleAuthConfig(["https://www.googleapis.com/auth/spreadsheets"]));
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

  const tables = await readAll();
  const ids = testIds(tables);
  const rows = affectedRows(tables, ids);
  if (rows.length === 0) {
    console.log("Nothing to remove — no test rows found.");
    return;
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const gid = new Map<string, number>();
  (meta.data.sheets ?? []).forEach((s) => {
    if (s.properties?.title && s.properties.sheetId != null) gid.set(s.properties.title, s.properties.sheetId);
  });

  const byTab = new Map<string, number[]>();
  rows.forEach((r) => byTab.set(r.tab, [...(byTab.get(r.tab) ?? []), r.rowNumber]));

  const requests: object[] = [];
  for (const [tab, rowNumbers] of byTab) {
    const sheetId = gid.get(tab);
    if (sheetId == null) {
      console.error(`  ! no tab named ${tab}; skipping`);
      continue;
    }
    // Descending, so earlier deletions do not move later targets.
    const sorted = [...new Set(rowNumbers)].sort((a, b) => b - a);
    console.log(`  ${tab.padEnd(20)} removing ${sorted.length} row(s): ${sorted.join(", ")}`);
    for (const rowNumber of sorted) {
      requests.push({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber }
        }
      });
    }
  }

  console.log(`\n${rows.length} row(s) across ${byTab.size} tab(s).`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to delete.");
    return;
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  console.log("Deleted.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
