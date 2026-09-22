import { existsSync, readFileSync } from "node:fs";
import { envConfig } from "./env";

/**
 * Resolves Google service-account credentials from the environment.
 *
 * Two ways, because the two places this runs are different:
 *
 *  - **A key file** (`GOOGLE_SERVICE_ACCOUNT_FILE`) for local work and any host
 *    with a writable disk. Keeps the private key out of shell history and
 *    process listings.
 *  - **Inline JSON** (`GOOGLE_SERVICE_ACCOUNT_JSON`) for serverless hosts such
 *    as Vercel, which have no persistent filesystem to put a secret file on.
 *    Accepts raw JSON or base64 — base64 is safer to paste into a dashboard,
 *    because the private key contains newlines that some UIs mangle.
 *
 * Inline JSON wins when both are present, so a deployment cannot accidentally
 * fall back to a stale file baked into an image.
 */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/** Which environment variable the key actually came from. */
export interface ResolvedCredentials {
  source: string;
  credentials: ServiceAccountKey;
}

export interface GoogleAuthConfig {
  credentials?: { client_email: string; private_key: string };
  keyFile?: string;
  scopes: string[];
}

function parseInlineJson(raw: string): ServiceAccountKey {
  let text = raw.trim();

  // Base64 has no braces; raw JSON starts with one.
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8").trim();
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is neither JSON nor valid base64.");
    }
  }

  let parsed: { client_email?: string; private_key?: string; project_id?: string; type?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON could not be parsed as JSON.");
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }

  return {
    client_email: parsed.client_email,
    // Dashboards frequently store the key with literal \n rather than newlines.
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    project_id: parsed.project_id
  };
}

/**
 * Resolves the key and reports where it came from.
 *
 * Setup tooling uses this so it describes the configuration you actually have
 * rather than the one it assumes; `googleAuthConfig` is built on top of it.
 */
export function resolveGoogleCredentials(): ResolvedCredentials {
  const inline = envConfig.serviceAccountJson;
  if (inline) {
    return { source: "GOOGLE_SERVICE_ACCOUNT_JSON (inline)", credentials: parseInlineJson(inline) };
  }

  const file = envConfig.serviceAccountFile;
  if (file) {
    if (!existsSync(file)) throw new Error(missingFileMessage(file));

    let parsed: { client_email?: string; private_key?: string; project_id?: string; type?: string };
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      throw new Error(`${file} is not valid JSON — re-download the key from Cloud Console.`);
    }
    if (parsed.type !== "service_account" || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        `${file} is not a service-account key (found type "${parsed.type ?? "unknown"}"). ` +
          "In Cloud Console choose Service account → Keys → Add key → JSON."
      );
    }
    return {
      source: file,
      credentials: {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        project_id: parsed.project_id
      }
    };
  }

  throw new Error(NO_CREDENTIALS);
}

/**
 * A path that does not exist is the likeliest misconfiguration on a serverless
 * host: GOOGLE_SERVICE_ACCOUNT_FILE gets copied from the local .env, but there
 * is no filesystem to put the key on. Say so, rather than letting googleapis
 * fail later with an ENOENT nobody can act on.
 */
function missingFileMessage(file: string): string {
  return (
    `GOOGLE_SERVICE_ACCOUNT_FILE points at "${file}", which does not exist. ` +
    "On a serverless host (Vercel, Lambda) there is no writable disk for a key file — " +
    "remove that variable and set GOOGLE_SERVICE_ACCOUNT_JSON to the key itself instead " +
    "(base64 is safest: base64 -i secrets/service-account.json | tr -d '\\n')."
  );
}

const NO_CREDENTIALS =
  "No Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON (serverless) or GOOGLE_SERVICE_ACCOUNT_FILE (local).";

export function googleAuthConfig(scopes: string[]): GoogleAuthConfig {
  const inline = envConfig.serviceAccountJson;
  if (inline) return { credentials: parseInlineJson(inline), scopes };

  const file = envConfig.serviceAccountFile;
  if (file) {
    if (!existsSync(file)) throw new Error(missingFileMessage(file));
    return { keyFile: file, scopes };
  }

  throw new Error(NO_CREDENTIALS);
}

/**
 * True when usable credentials are configured.
 *
 * A key-file path that does not exist counts as NOT configured, so the app
 * reports "Drive is not set up" rather than appearing configured and then
 * failing on every call.
 */
export function hasGoogleCredentials(): boolean {
  if (envConfig.serviceAccountJson) return true;
  const file = envConfig.serviceAccountFile;
  return Boolean(file && existsSync(file));
}
