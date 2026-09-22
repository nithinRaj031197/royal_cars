/**
 * Credential resolution. Vercel has no writable disk, so the private key has to
 * arrive as an environment variable — and dashboards mangle newlines, so both
 * raw JSON and base64 must work.
 */
import { describe, it, expect, afterEach } from "vitest";

const FAKE = {
  type: "service_account",
  project_id: "p",
  client_email: "svc@p.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nLINE1\nLINE2\n-----END PRIVATE KEY-----\n"
};

// envConfig reads process.env through getters at call time, so a single import
// is enough — each case just sets the variables it needs.
import { googleAuthConfig, hasGoogleCredentials } from "@/lib/config/google-credentials";

afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
});

describe("google credentials", () => {
  it("accepts raw inline JSON", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(FAKE);
    const cfg = googleAuthConfig(["scope-a"]);
    expect(cfg.credentials?.client_email).toBe(FAKE.client_email);
    expect(cfg.credentials?.private_key).toContain("BEGIN PRIVATE KEY");
    expect(cfg.keyFile).toBeUndefined();
    expect(cfg.scopes).toEqual(["scope-a"]);
  });

  it("accepts base64, which is what survives a dashboard paste", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(FAKE)).toString("base64");
    const cfg = googleAuthConfig([]);
    expect(cfg.credentials?.client_email).toBe(FAKE.client_email);
    expect(cfg.credentials?.private_key.split("\n").length).toBeGreaterThan(2);
  });

  it("repairs a key whose newlines were flattened to literal \\n", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      ...FAKE,
      private_key: "-----BEGIN PRIVATE KEY-----\\nLINE1\\n-----END PRIVATE KEY-----\\n"
    });
    const key = googleAuthConfig([]).credentials!.private_key;
    expect(key).not.toContain("\\n");
    expect(key.split("\n").length).toBeGreaterThan(2);
  });

  it("falls back to a key file when no inline JSON is set", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = "./secrets/service-account.json";
    const cfg = googleAuthConfig([]);
    expect(cfg.keyFile).toBe("./secrets/service-account.json");
    expect(cfg.credentials).toBeUndefined();
  });

  it("prefers inline JSON over a file, so a stale baked-in key cannot win", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = "./secrets/service-account.json";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(FAKE);
    const cfg = googleAuthConfig([]);
    expect(cfg.credentials?.client_email).toBe(FAKE.client_email);
    expect(cfg.keyFile).toBeUndefined();
  });

  it("reports what is wrong rather than failing obscurely later", () => {
    expect(hasGoogleCredentials()).toBe(false);
    expect(() => googleAuthConfig([])).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON|GOOGLE_SERVICE_ACCOUNT_FILE/);

    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not json and not base64 {{{";
    expect(() => googleAuthConfig([])).toThrow(/could not be parsed|neither JSON/);

    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: "service_account" });
    expect(() => googleAuthConfig([])).toThrow(/client_email or private_key/);
  });
});

describe("misconfiguration is reported, not left to fail later", () => {
  it("rejects a key-file path that does not exist, naming the serverless fix", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = "./secrets/does-not-exist.json";
    expect(hasGoogleCredentials()).toBe(false);
    expect(() => googleAuthConfig([])).toThrow(/does not exist/);
    expect(() => googleAuthConfig([])).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON/);
  });

  it("still prefers inline JSON even when a bad file path is also set", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = "./secrets/does-not-exist.json";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(FAKE);
    expect(hasGoogleCredentials()).toBe(true);
    expect(googleAuthConfig([]).credentials?.client_email).toBe(FAKE.client_email);
  });
});
