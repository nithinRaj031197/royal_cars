import { getStore } from "@/lib/store";
import { isRole, type Role } from "@/lib/permissions";
import { verifyPassword } from "./password";
import { todayISO } from "@/lib/dates";

/**
 * Sign-in against the Staff tab.
 *
 * Roles that may sign in today. The other roles exist in the data and the
 * permission model, but their screens are not ready, so they are refused at the
 * door rather than shown a half-built app. Widening this is a one-line change.
 */
export const LOGIN_ENABLED_ROLES: Role[] = ["owner"];

/** Wrong password attempts before the account is temporarily locked. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type SignInFailure =
  | "invalid"          // wrong email or password — deliberately indistinguishable
  | "inactive"
  | "role-not-enabled"
  | "locked"
  | "no-password";

export interface SignInSuccess {
  ok: true;
  staffId: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export type SignInResult = SignInSuccess | { ok: false; reason: SignInFailure; retryAfterMinutes?: number };

export async function signInWithPassword(emailRaw: string, password: string): Promise<SignInResult> {
  const email = emailRaw.trim().toLowerCase();
  const store = getStore();
  const staff = await store.list("Staff", { activeOnly: false });
  const row = staff.find((s) => (s.email ?? "").trim().toLowerCase() === email);

  // Same answer whether the address is unknown or the password is wrong, so the
  // form cannot be used to discover which addresses are staff.
  if (!row) return { ok: false, reason: "invalid" };

  const lockedUntil = row.lockedUntil ? Date.parse(row.lockedUntil) : 0;
  if (lockedUntil && lockedUntil > Date.now()) {
    return { ok: false, reason: "locked", retryAfterMinutes: Math.ceil((lockedUntil - Date.now()) / 60000) };
  }

  if ((row.active ?? "TRUE") === "FALSE") return { ok: false, reason: "inactive" };
  if (!row.passwordHash) return { ok: false, reason: "no-password" };

  const good = await verifyPassword(password, row.passwordHash);
  if (!good) {
    await recordFailedAttempt(row.id, Number(row.failedAttempts ?? "0"), row.version);
    return { ok: false, reason: "invalid" };
  }

  const role = isRole(row.role ?? "") ? (row.role as Role) : "sales";
  if (!LOGIN_ENABLED_ROLES.includes(role)) return { ok: false, reason: "role-not-enabled" };

  await recordSuccess(row.id, row.version);
  return {
    ok: true,
    staffId: row.id,
    email,
    name: row.name || email,
    role,
    mustChangePassword: (row.mustChangePassword ?? "FALSE") === "TRUE"
  };
}

/**
 * Bookkeeping around a sign-in attempt.
 *
 * Deliberately best-effort: a spreadsheet write failing must never turn a valid
 * sign-in into a rejection, nor block the response. The counters are a
 * brute-force speed bump, not an access control.
 */
async function recordFailedAttempt(id: string, previous: number, version: number): Promise<void> {
  const attempts = previous + 1;
  const data: Record<string, string> = { failedAttempts: String(attempts) };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
    data.failedAttempts = "0";
  }
  await getStore()
    .update("Staff", id, data, version, { actor: "system" })
    .catch(() => undefined);
}

async function recordSuccess(id: string, version: number): Promise<void> {
  await getStore()
    .update("Staff", id, { lastLoginAt: todayISO(), failedAttempts: "0", lockedUntil: "" }, version, { actor: "system" })
    .catch(() => undefined);
}

/** Message shown for each failure. Never reveals whether an address exists. */
export function describeSignInFailure(result: { reason: SignInFailure; retryAfterMinutes?: number }): string {
  switch (result.reason) {
    case "locked":
      return `Too many attempts. Try again in ${result.retryAfterMinutes ?? LOCKOUT_MINUTES} minutes.`;
    case "inactive":
      return "That account has been deactivated. Ask an owner to re-enable it.";
    case "role-not-enabled":
      return "Sign-in is currently limited to owner accounts.";
    case "no-password":
      return "No password has been set for that account yet. Ask an owner to set one.";
    default:
      return "Email or password is incorrect.";
  }
}
