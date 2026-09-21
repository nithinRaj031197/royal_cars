/**
 * Clears every DATA row from the application tabs, leaving the header row.
 *
 * Destructive by design, for resetting a test spreadsheet between runs. It
 * refuses unless CONFIRM_RESET=yes is set, so it cannot be run by accident.
 *
 * Usage: CONFIRM_RESET=yes pnpm sheets:reset
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
  if (process.env.CONFIRM_RESET !== "yes") {
    console.error(`Refusing to clear ${sheetsId}. Re-run with CONFIRM_RESET=yes if that is what you want.`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({ keyFile: saFile, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });

  // One batched clear rather than one request per tab, to stay inside quota.
  const ranges = (Object.keys(TABLES) as Array<keyof typeof TABLES>).map((n) => `'${n}'!A2:ZZ`);
  await sheets.spreadsheets.values.batchClear({ spreadsheetId: sheetsId, requestBody: { ranges } });
  console.log(`Cleared data rows from ${ranges.length} tab(s). Headers untouched.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
