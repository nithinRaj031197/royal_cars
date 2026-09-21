/**
 * Read-only validation of all application tabs against the schema registry.
 * Usage: pnpm sheets:validate
 */
import { existsSync } from "node:fs";
import { google } from "googleapis";
import { TABLES } from "../src/lib/store/tables";

async function main() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const saFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "./secrets/service-account.json";
  if (!sheetsId || !existsSync(saFile)) {
    console.error("GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_FILE are required.");
    process.exit(1);
  }
  const auth = new google.auth.GoogleAuth({ keyFile: saFile, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });

  // One batchGet instead of 32 separate reads. Sequential reads exhaust the
  // Sheets quota (60 read requests per minute per user) on a schema this size,
  // which is how this script first failed against a real spreadsheet.
  const names = Object.keys(TABLES) as Array<keyof typeof TABLES>;
  let headers: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetsId,
      ranges: names.map((n) => `'${n}'!A1:1`)
    });
    headers = (res.data.valueRanges ?? []).map((r) => (r.values?.[0] ?? []) as string[]);
  } catch (err) {
    const e = err as { code?: number; message?: string };
    console.error(`Could not read the spreadsheet: ${e.message ?? e.code}`);
    process.exit(1);
  }

  let failures = 0;
  names.forEach((name, i) => {
    const def = TABLES[name]!;
    const header = headers[i] ?? [];
    if (header.length === 0) {
      failures++;
      console.log(`EMPTY    ${name} — no header row. Run: pnpm sheets:setup`);
      return;
    }
    const ok = def.columns.every((c, j) => (header[j] ?? "").trim() === c);
    if (!ok) {
      failures++;
      const firstBad = def.columns.findIndex((c, j) => (header[j] ?? "").trim() !== c);
      console.log(
        `MISMATCH ${name}: column ${firstBad + 1} should be "${def.columns[firstBad]}", found "${header[firstBad] ?? "(empty)"}"`
      );
    } else if (header.length > def.columns.length) {
      console.log(`OK*      ${name} — ${header.length - def.columns.length} unexpected extra column(s): ${header.slice(def.columns.length).join(", ")}`);
    } else {
      console.log(`OK       ${name}`);
    }
  });

  console.log(failures === 0 ? `\nAll ${Object.keys(TABLES).length} tabs valid.` : `\n${failures} tab(s) need attention.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
