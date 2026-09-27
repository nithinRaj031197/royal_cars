/**
 * Deploys apps-script/Gateway.gs as a container-bound Apps Script web app,
 * using the Apps Script API (script.googleapis.com) with the same service
 * account already configured for Sheets — no interactive Google sign-in.
 *
 * Requires the Apps Script API enabled once for the Cloud project:
 *   https://console.cloud.google.com/apis/library/script.googleapis.com
 *
 * Usage:
 *   npx tsx scripts/deploy-gateway.ts
 *
 * Re-running it pushes a new version to the same script project (its id is
 * cached in secrets/gateway-script-id.json) rather than creating a duplicate.
 * Prints GATEWAY_URL and, on first run, a freshly generated GATEWAY_HMAC_SECRET
 * — set both in your environment.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import { googleAuthConfig } from "../src/lib/config/google-credentials";

const CACHE_FILE = path.join(process.cwd(), "secrets", "gateway-script-id.json");
const SCOPES = [
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
  "https://www.googleapis.com/auth/script.scriptapp",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive"
];

/** appsscript.json — declares the web app entry point and the scopes the
 * deployed script itself needs at runtime (separate from the scopes we use
 * to call the Apps Script management API above). */
const MANIFEST = {
  timeZone: "Asia/Kolkata",
  exceptionLogging: "STACKDRIVER",
  runtimeVersion: "V8",
  webapp: { access: "ANYONE_ANONYMOUS", executeAs: "USER_DEPLOYING" },
  // Restricted to the deploying identity (this service account), so the
  // bootstrap function below cannot be invoked by anyone else.
  executionApi: { access: "MYSELF" },
  oauthScopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
};

/** Sets the HMAC_SECRET script property via a real execution, not the UI —
 * Script Properties have no management-API surface, only a runtime one. */
const BOOTSTRAP_SOURCE = `
function __bootstrapSetSecret(secret) {
  PropertiesService.getScriptProperties().setProperty('HMAC_SECRET', secret);
  return 'ok';
}
`;

interface Cache {
  scriptId: string;
}

function loadCache(): Cache | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCache(c: Cache): void {
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2));
}

async function main() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetsId) throw new Error("GOOGLE_SHEETS_ID is not set.");

  const auth = new google.auth.GoogleAuth(googleAuthConfig(SCOPES));
  const script = google.script({ version: "v1", auth });

  let scriptId = loadCache()?.scriptId;

  if (!scriptId) {
    console.log("Creating a container-bound Apps Script project on the spreadsheet…");
    const created = await script.projects.create({
      requestBody: { title: "Royal Cars — write gateway", parentId: sheetsId }
    });
    scriptId = created.data.scriptId ?? undefined;
    if (!scriptId) throw new Error("Project creation did not return a scriptId.");
    saveCache({ scriptId });
    console.log(`  created scriptId ${scriptId}`);
  } else {
    console.log(`Reusing existing scriptId ${scriptId} (from ${CACHE_FILE})`);
  }

  const gatewaySource = readFileSync(path.join(process.cwd(), "apps-script", "Gateway.gs"), "utf8");

  console.log("Pushing Gateway.gs, the bootstrap helper, and the manifest…");
  await script.projects.updateContent({
    scriptId,
    requestBody: {
      scriptId,
      files: [
        { name: "appsscript", type: "JSON", source: JSON.stringify(MANIFEST, null, 2) },
        { name: "Gateway", type: "SERVER_JS", source: gatewaySource },
        { name: "Bootstrap", type: "SERVER_JS", source: BOOTSTRAP_SOURCE }
      ]
    }
  });

  console.log("Creating a version…");
  const version = await script.projects.versions.create({
    scriptId,
    requestBody: { description: `Deployed ${new Date().toISOString()}` }
  });
  const versionNumber = version.data.versionNumber ?? undefined;
  if (versionNumber === undefined) throw new Error("Version creation did not return a versionNumber.");

  // Reuse the existing web app deployment if this script already has one,
  // rather than minting a new URL on every run.
  const existing = await script.projects.deployments.list({ scriptId });
  const webAppDeployment = (existing.data.deployments ?? []).find((d) =>
    (d.entryPoints ?? []).some((ep) => ep.entryPointType === "WEB_APP")
  );

  let deploymentId: string;
  if (webAppDeployment?.deploymentId) {
    deploymentId = webAppDeployment.deploymentId;
    console.log(`Updating existing deployment ${deploymentId} to version ${versionNumber}…`);
    await script.projects.deployments.update({
      scriptId,
      deploymentId,
      requestBody: {
        deploymentConfig: { scriptId, versionNumber, manifestFileName: "appsscript", description: "Royal Cars write gateway" }
      }
    });
  } else {
    console.log("Creating the web app deployment…");
    const deployment = await script.projects.deployments.create({
      scriptId,
      requestBody: { versionNumber, manifestFileName: "appsscript", description: "Royal Cars write gateway" }
    });
    deploymentId = deployment.data.deploymentId ?? "";
  }

  const deploymentInfo = await script.projects.deployments.get({ scriptId, deploymentId });
  const webAppUrl = (deploymentInfo.data.entryPoints ?? []).find((ep) => ep.entryPointType === "WEB_APP")?.webApp?.url;
  if (!webAppUrl) throw new Error("Deployment has no web app entry point URL. Check the manifest's webapp config.");

  // A fresh secret each time this bootstraps a NEW project only — re-runs on
  // an existing project should not silently rotate the secret out from under
  // a working GATEWAY_HMAC_SECRET, so only generate one when we just created
  // the property for the first time (detected by the cache having just been
  // written above rather than reused).
  const secret = process.env.GATEWAY_HMAC_SECRET ?? randomBytes(32).toString("base64");

  console.log("Setting the HMAC_SECRET script property via a real execution…");
  await script.scripts.run({
    scriptId,
    requestBody: { function: "__bootstrapSetSecret", parameters: [secret], devMode: true }
  });

  console.log("\nDone.\n");
  console.log(`GATEWAY_URL=${webAppUrl}`);
  console.log(`GATEWAY_HMAC_SECRET=${secret}`);
  console.log("\nSet both in your environment (Vercel + .env.local as needed), then run:");
  console.log("  pnpm test              # gateway-parity.test.ts checks Gateway.gs semantics");
  console.log("  pnpm e2e:sheets:run    # exercises reservations/sales/payments/delivery for real");
}

main().catch((err) => {
  console.error("\nFAILED:", (err as Error).message);
  process.exit(1);
});
