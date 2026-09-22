/**
 * Refuses to start a production build while a dev server is running.
 *
 * `next build` and `next dev` both write to `.next`. A build run alongside dev
 * overwrites the chunks the dev server is serving, and the browser then fails
 * with "Cannot read properties of undefined (reading 'call')" from webpack.js.
 * The build itself succeeds, so the damage is not obvious until the next reload.
 *
 * Set ALLOW_BUILD_WITH_DEV=1 to override.
 */
import { execSync } from "node:child_process";

if (process.env.ALLOW_BUILD_WITH_DEV === "1") process.exit(0);

let running = "";
try {
  running = execSync("pgrep -fl 'next dev' 2>/dev/null || true", { encoding: "utf8" }).trim();
} catch {
  // pgrep is unavailable (or matched nothing); let the build proceed.
  process.exit(0);
}

if (running) {
  console.error(
    [
      "",
      "  A dev server is running, and `next build` writes to the same .next directory.",
      "  Building now would corrupt it — the dev server keeps serving, then fails with",
      '  "Cannot read properties of undefined (reading \'call\')" on the next reload.',
      "",
      "  Stop the dev server first:",
      "",
      "      pnpm clean          # kills dev servers and removes .next",
      "",
      "  Or override deliberately:  ALLOW_BUILD_WITH_DEV=1 pnpm build",
      ""
    ].join("\n")
  );
  process.exit(1);
}
