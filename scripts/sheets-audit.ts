/**
 * Read-only reconciliation audit against the configured store.
 * Usage: pnpm sheets:audit  (or DEMO_MODE=1 pnpm sheets:audit for local demo data)
 */
import { getStore } from "../src/lib/store";
import { reconcile } from "../src/server/services/reconcile";

async function main() {
  const store = getStore();
  const issues = await reconcile(store);
  if (issues.length === 0) {
    console.log("No reconciliation issues found.");
    return;
  }
  for (const i of issues) {
    console.log(`[${i.severity}] ${i.entity}${i.id ? ` (${i.id})` : ""}: ${i.problem}`);
  }
  console.log(`\n${issues.length} issue(s).`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
