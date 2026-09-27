/**
 * Row-count snapshot of every tab, for proving that a Sheets test run left
 * nothing behind. One batchGet, not 32 reads — the per-minute quota is real.
 */
import { google } from "googleapis";
import { googleAuthConfig } from "../../src/lib/config/google-credentials";
import { TABLES } from "../../src/lib/store/tables";

export async function snapshot(): Promise<Record<string, number>> {
  const auth = new google.auth.GoogleAuth(googleAuthConfig(["https://www.googleapis.com/auth/spreadsheets"]));
  const sheets = google.sheets({ version: "v4", auth });
  const names = Object.keys(TABLES);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
    ranges: names.map((n) => `'${n}'!A:A`)
  });
  const out: Record<string, number> = {};
  (res.data.valueRanges ?? []).forEach((vr, i) => {
    const rows = vr.values?.length ?? 0;
    out[names[i]!] = Math.max(0, rows - 1); // minus the header
  });
  return out;
}

if (process.argv[1]?.includes("snapshot")) {
  snapshot()
    .then((s) => {
      const nonEmpty = Object.entries(s).filter(([, n]) => n > 0);
      console.log(JSON.stringify(s));
      console.error(`tabs with data: ${nonEmpty.map(([k, n]) => `${k}=${n}`).join(", ")}`);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
