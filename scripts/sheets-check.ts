/**
 * Preflight for the Google connection.
 *
 * Reports exactly what is present, what is missing and what to do next, without
 * writing anything. Safe to run at any point during setup — including before
 * the spreadsheet exists.
 *
 * Usage: pnpm sheets:check
 */
import { google } from "googleapis";

import { googleAuthConfig, resolveGoogleCredentials } from "../src/lib/config/google-credentials";

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m: string) => console.log(`    ${m}`);

async function main() {
  console.log("\nGoogle connection preflight\n");

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  let failed = false;

  // 1. Credentials ---------------------------------------------------------
  // Resolved exactly as the app resolves them, so this reports on the
  // configuration you actually have — inline JSON (serverless) or a key file.
  try {
    const { source, credentials } = resolveGoogleCredentials();
    ok(`Service-account key read from ${source}`);
    info(`project:       ${credentials.project_id ?? "(none)"}`);
    info(`share sheet with: ${credentials.client_email}`);
  } catch (err) {
    bad((err as Error).message);
    failed = true;
  }

  // 2. Spreadsheet id ------------------------------------------------------
  if (!sheetId) {
    bad("GOOGLE_SHEETS_ID is not set");
    info("Create a spreadsheet, then copy the id from its URL:");
    info("https://docs.google.com/spreadsheets/d/<THIS PART>/edit");
    failed = true;
  } else {
    ok(`GOOGLE_SHEETS_ID set (${sheetId.slice(0, 8)}…)`);
  }

  if (failed) {
    console.log("\nFix the items above, then run this again.\n");
    process.exit(1);
  }

  // 3. Can we actually reach it? -------------------------------------------
  try {
    const auth = new google.auth.GoogleAuth(
      googleAuthConfig([
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ])
    );
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    ok(`Opened "${meta.data.properties?.title ?? "(untitled)"}"`);
    const tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);
    info(`${tabs.length} tab(s): ${tabs.slice(0, 8).join(", ")}${tabs.length > 8 ? " …" : ""}`);
    console.log("\nReady. Next: pnpm sheets:setup\n");
  } catch (err) {
    const e = err as { code?: number; message?: string };
    bad(`Could not open the spreadsheet (${e.code ?? "error"})`);
    if (e.code === 403) {
      info("The service account cannot see it. Share the spreadsheet with the");
      info("client_email above, giving Editor access.");
    } else if (e.code === 404) {
      info("No spreadsheet with that id. Check GOOGLE_SHEETS_ID.");
    } else if (/API has not been used|disabled/i.test(e.message ?? "")) {
      info("Enable the Google Sheets API and Google Drive API for this project.");
    } else {
      info(e.message ?? "unknown error");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
