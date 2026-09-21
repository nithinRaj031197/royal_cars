import { createHmac, timingSafeEqual } from "node:crypto";
import { envConfig } from "../config/env";

/**
 * Serialized write gateway (Google Apps Script Web App).
 *
 * The gateway holds a Google Apps Script LockService lock, so critical
 * mutations (payments, reservations, sale completion) are serialized across
 * all app instances. This file only builds/verifies authenticated requests;
 * the Apps Script source lives in apps-script/Gateway.gs.
 */

export interface GatewayAction {
  type: "create" | "update" | "archive" | "assert" | "assert-field" | "assert-sum";
  table: string; // TableName; plain string because this crosses the wire
  /** Row id or "$ref:<name>" template. Required for update/archive. */
  id?: string;
  data?: Record<string, string>;
  /** For update: optimistic version check performed under the lock. */
  expectedVersion?: number;
  /** create: name other actions can reference via "$ref:<name>". */
  as?: string;
  /** assert/assert-field options. */
  notExists?: {
    field: string;
    equals: string;
    and?: Array<{ field: string; equals: string }>;
    andNot?: { field: string; equals: string };
  };
  exists?: { field: string; equals: string; and?: Array<{ field: string; equals: string }> };
  field?: string;
  equals?: string;
  notEquals?: string;
  notGreaterThan?: number;
  /** assert-sum options. */
  where?: Array<{ field: string; equals: string }>;
  excludeWhenSet?: string[];
  plus?: number;
  message?: string;
  status?: number;
}

export interface GatewayWriteRequest {
  operationId: string;
  kind: string;
  entityType: string;
  entityId?: string;
  actor: string;
  issuedAt: string;
  /** Step name for progress tracking / retries (see Operations tab). */
  step?: string;
  actions: GatewayAction[];
}

function hmac(method: "sign" | "verify", payload: string): string {
  const secret = envConfig.gatewayHmacSecret ?? envConfig.gatewayToken ?? "insecure-dev";
  if (method === "sign") return createHmac("sha256", secret).update(payload).digest("hex");
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const got = payload.length >= 64 ? payload.slice(-64) : "";
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(got, "utf8")) ? "ok" : "bad";
  } catch {
    return "bad";
  }
}

export function signRequest(req: GatewayWriteRequest): string {
  const payload = JSON.stringify(req);
  const sig = hmac("sign", payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySignature(envelope: string): GatewayWriteRequest | null {
  const [b64, sig] = envelope.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  if (hmac("verify", `${payload}.${sig}`) !== "ok") return null;
  return JSON.parse(payload) as GatewayWriteRequest;
}

export class GatewayUnavailableError extends Error {
  readonly status = 503;
  readonly retryable = true;
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnavailableError";
  }
}

export class GatewayRejectedError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
    this.name = "GatewayRejectedError";
  }
}

/** Posts a signed critical write to the gateway with bounded retries + backoff. */
export async function postCriticalWrite(
  req: GatewayWriteRequest,
  opts?: { maxAttempts?: number }
): Promise<{ results: Record<string, unknown> }> {
  const url = envConfig.gatewayUrl;
  if (!url) throw new GatewayUnavailableError("Write gateway is not configured (GATEWAY_URL).");

  const maxAttempts = opts?.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: signRequest(req),
        signal: AbortSignal.timeout(30_000)
      });
      if (res.status === 429 || res.status >= 500) {
        throw new GatewayUnavailableError(`Gateway responded ${res.status}`);
      }
      const json = (await res.json()) as { ok?: boolean; error?: string; status?: number; results?: Record<string, unknown> };
      if (!json.ok) throw new GatewayRejectedError(json.error ?? "Gateway rejected the write", json.status ?? 409);
      return { results: json.results ?? {} };
    } catch (err) {
      lastErr = err;
      if (err instanceof GatewayRejectedError) throw err; // permanent rejection, do not retry
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 120)));
      }
    }
  }
  if (lastErr instanceof GatewayUnavailableError) throw lastErr;
  throw new GatewayUnavailableError(`Gateway unreachable: ${(lastErr as Error)?.message ?? "unknown"}`);
}
