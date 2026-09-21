/**
 * Creates the dedicated application spreadsheet structure:
 * every tab with exact headers. Existing tabs are validated, never wiped.
 *
 * Usage:
 *   GOOGLE_SHEETS_ID=... GOOGLE_SERVICE_ACCOUNT_FILE=./secrets/sa.json pnpm sheets:setup
 * Without GOOGLE_SHEETS_ID it creates a new spreadsheet and prints its ID.
 */
import { existsSync } from "node:fs";
import { google } from "googleapis";

async function main() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const saFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "./secrets/service-account.json";
  if (!existsSync(saFile)) {
    console.error(`Service account file not found at ${saFile}. See DEPLOYMENT.md for setup.`);
    process.exit(1);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: saFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const sheets = google.sheets({ version: "v4", auth });

  let spreadsheetId = sheetsId;
  if (!spreadsheetId) {
    const created = await sheets.spreadsheets.create({
      requestBody: { properties: { title: "Royal Cars Admin (application data)" } }
    });
    spreadsheetId = created.data.spreadsheetId!;
    console.log(`Created spreadsheet: ${spreadsheetId}`);
    console.log("Set GOOGLE_SHEETS_ID to this value in your .env");
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));

  const { TABLES, isTableName } = await import("../src/lib/store/tables");

  const missing = (Object.keys(TABLES) as Array<keyof typeof TABLES>).filter((t) => !existing.has(t));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }
    });
    console.log(`Added tabs: ${missing.join(", ")}`);
  }

  let mismatches = 0;
  for (const [name, def] of Object.entries(TABLES) as Array<[keyof typeof TABLES, { columns: string[] }]>) {
    const header = (
      await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${name}'!A1:1` })
    ).data.values?.[0] as string[] | undefined;

    if (!header || header.length === 0) {
      // Only ever writes into an empty header row, so existing data is untouched.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${name}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [def.columns] }
      });
      console.log(`Initialized headers for ${name} (${def.columns.length} columns)`);
    } else if (
      header.length < def.columns.length &&
      header.every((c, i) => (c ?? "").trim() === def.columns[i])
    ) {
      // The tab matches as far as it goes and the schema has grown. Appending
      // the new headers to the right is safe: existing rows and columns are
      // untouched, and the store reads missing trailing cells as empty.
      const added = def.columns.slice(header.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${name}'!${columnLetter(header.length + 1)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [added] }
      });
      console.log(`MIGRATED ${name} — added ${added.length} column(s): ${added.join(", ")}`);
    } else {
      const ok = def.columns.every((c, i) => (header[i] ?? "").trim() === c);
      if (!ok) {
        mismatches++;
        const firstBad = def.columns.findIndex((c, i) => (header[i] ?? "").trim() !== c);
        console.log(
          `MISMATCH ${name} — expected ${def.columns.length} columns; first difference at column ` +
          `${firstBad + 1}: expected "${def.columns[firstBad]}", found "${header[firstBad] ?? "(empty)"}"`
        );
      } else {
        console.log(`OK       ${name}`);
      }
    }
  }

  // Freeze the header row on every tab so manual scrolling cannot hide it.
  const meta2 = await sheets.spreadsheets.get({ spreadsheetId });
  const freezeRequests = (meta2.data.sheets ?? [])
    .filter((sh) => sh.properties?.title && isTableName(sh.properties.title))
    .filter((sh) => (sh.properties?.gridProperties?.frozenRowCount ?? 0) < 1)
    .map((sh) => ({
      updateSheetProperties: {
        properties: { sheetId: sh.properties!.sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount"
      }
    }));
  if (freezeRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: freezeRequests } });
    console.log(`Froze the header row on ${freezeRequests.length} tab(s).`);
  }

  if (mismatches > 0) {
    console.error(
      `\n${mismatches} tab(s) do not match the schema. Nothing was overwritten. ` +
      `Fix the headers by hand (or copy the data into a fresh spreadsheet and re-run) before starting the app.`
    );
    process.exit(1);
  }

  console.log(`\nSetup complete for spreadsheet ${spreadsheetId}.`);
  console.log("Share it with the service account email as Editor, then run: pnpm sheets:validate");
}

/** 1 -> A, 27 -> AA. Sheets ranges are 1-indexed by column. */
function columnLetter(n: number): string {
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
