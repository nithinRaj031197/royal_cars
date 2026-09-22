/**
 * Refuses to start a production build while a LOCAL dev server is running.
 *
 * `next build` and `next dev` both write to `.next`. A build run alongside dev
 * overwrites the chunks the dev server is serving, and the browser then fails
 * with "Cannot read properties of undefined (reading 'call')" from webpack.js.
 * The build itself succeeds, so the damage is not obvious until the next reload.
 *
 * This is a local-development safeguard only. It never runs on a build server,
 * where there is no dev server and a false positive would fail the deploy.
 * Set ALLOW_BUILD_WITH_DEV=1 to skip it anywhere.
 */
import { execSync } from "node:child_process";

const SKIP = [
  process.env.ALLOW_BUILD_WITH_DEV === "1",
  // Every major CI provider sets at least one of these.
  process.env.CI,
  process.env.VERCEL,
  process.env.NETLIFY,
  process.env.GITHUB_ACTIONS,
  process.env.BUILD_ID,
  process.env.RENDER
].some(Boolean);

if (SKIP) process.exit(0);

let running = "";
try {
  // The bracket stops pgrep matching the shell that is running pgrep: the
  // literal string "next dev" never appears in this command line, but the
  // pattern still matches a real `next dev` process. Without it, Linux pgrep
  // matches its own parent shell and the guard fires on every build.
  running = execSync("pgrep -fl '[n]ext dev' 2>/dev/null || true", { encoding: "utf8" }).trim();
} catch {
  // pgrep unavailable, or matched nothing. Never block on an unknown.
  process.exit(0);
}

if (!running) process.exit(0);

console.error(
  [
    "",
    "  A dev server is running, and `next build` writes to the same .next directory.",
    "  Building now would corrupt it — the dev server keeps serving, then fails with",
    '  "Cannot read properties of undefined (reading \'call\')" on the next reload.',
    "",
    // PID and command only. The full pgrep line carries the process's whole
    // environment, which would put secrets into build logs.
    `  Found: pid ${running.split("\n")[0].trim().split(/\s+/).slice(0, 4).join(" ")}`,
    "",
    "  Stop it first:",
    "",
    "      pnpm clean          # kills dev servers and removes .next",
    "",
    "  Or override:  ALLOW_BUILD_WITH_DEV=1 pnpm build",
    ""
  ].join("\n")
);
process.exit(1);
