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
export interface GoogleAuthConfig {
  credentials?: { client_email: string; private_key: string };
  keyFile?: string;
  scopes: string[];
}

function parseInlineJson(raw: string): { client_email: string; private_key: string } {
  let text = raw.trim();

  // Base64 has no braces; raw JSON starts with one.
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8").trim();
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is neither JSON nor valid base64.");
    }
  }

  let parsed: { client_email?: string; private_key?: string; type?: string };
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
    private_key: parsed.private_key.replace(/\\n/g, "\n")
  };
}

export function googleAuthConfig(scopes: string[]): GoogleAuthConfig {
  const inline = envConfig.serviceAccountJson;
  if (inline) return { credentials: parseInlineJson(inline), scopes };

  const file = envConfig.serviceAccountFile;
  if (file) return { keyFile: file, scopes };

  throw new Error(
    "No Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON (serverless) or GOOGLE_SERVICE_ACCOUNT_FILE (local)."
  );
}

/** True when credentials are configured, without throwing. */
export function hasGoogleCredentials(): boolean {
  return Boolean(envConfig.serviceAccountJson || envConfig.serviceAccountFile);
}
