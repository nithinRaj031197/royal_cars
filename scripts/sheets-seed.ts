/**
 * Seeds the fictional demo dataset.
 *   DEMO_MODE=1 pnpm sheets:seed   → in-memory demo store (per-process; the dev
 *                                    server seeds itself, so this is only useful
 *                                    for checking the dataset builds cleanly)
 *   GOOGLE_SHEETS_ID=... pnpm sheets:seed → the configured spreadsheet
 *
 * The dataset itself lives in src/server/demo-seed.ts so the app and this
 * script always seed exactly the same records.
 */
import { getStore } from "../src/lib/store";
import { seedDemoData, DEMO_LOGIN_PROFILES, DEMO_OWNER_PASSWORD } from "../src/server/demo-seed";

async function main() {
  const store = getStore();
  await seedDemoData(store);
  console.log("Seed complete.");
  console.log("  Login profiles: " + DEMO_LOGIN_PROFILES.map((p) => p.email).join(" / "));
  console.log(`  Sign in as owner@royalcars.demo with password: ${DEMO_OWNER_PASSWORD}`);
  console.log("  Sign-in is limited to owner accounts for now.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
