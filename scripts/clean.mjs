/** Stops any dev server and removes the build cache. */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

try {
  execSync("pkill -f 'next dev' 2>/dev/null || true", { stdio: "ignore" });
  execSync("pkill -f 'next-server' 2>/dev/null || true", { stdio: "ignore" });
} catch {
  // Nothing was running.
}
rmSync(".next", { recursive: true, force: true });
console.log("Stopped dev servers and removed .next. Run `pnpm dev` to start again.");
