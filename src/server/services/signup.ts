import { getRepo } from "@/lib/repo";
import type { SignupInput } from "@/lib/form-schemas";
import { hashPassword, describePasswordProblem } from "../auth/password";

export type SignupResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Public self sign-up.
 *
 * Creates an inactive Staff row — the exact same `active` flag an owner
 * already uses to enable/disable an account from Settings, so no schema
 * change was needed to add an approval step. `signInWithPassword` already
 * refuses an inactive account with a clear message; approving it here is
 * just flipping that same flag from Settings.
 *
 * The requester chooses their own password, so `mustChangePassword` is not
 * set — that flag is for the CLI-generated-password path
 * (`scripts/staff-password.ts`), not this one.
 */
export async function requestSignup(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const problem = describePasswordProblem(input.password);
  if (problem) return { ok: false, error: problem };

  const repo = getRepo();
  const existing = (await repo.table("Staff").list({ activeOnly: false })).find(
    (s) => (s.email ?? "").trim().toLowerCase() === email
  );
  if (existing) {
    return {
      ok: false,
      error: "An account with this email already exists. Ask an owner for access, or sign in if you already have a password."
    };
  }

  const passwordHash = await hashPassword(input.password);
  const ctx = { actor: "signup:public" };
  const created = await repo.table("Staff").create(
    {
      email,
      name: input.name.trim(),
      role: input.role,
      active: "FALSE",
      phone: "",
      googleSub: "",
      lastLoginAt: "",
      passwordHash,
      mustChangePassword: "FALSE",
      failedAttempts: "0",
      lockedUntil: ""
    },
    ctx
  );
  await repo.logActivity(
    ctx,
    "staff.signup",
    "Staff",
    created.id,
    `${input.name} requested a ${input.role} account (pending owner approval)`
  );
  return { ok: true, id: created.id };
}
