import { describe, it, expect, beforeEach } from "vitest";
import { DemoStore } from "@/lib/store/demo-store";
import { setStoreForTests } from "@/lib/store";
import type { DataStore } from "@/lib/store/types";
import { signupInputSchema } from "@/lib/form-schemas";
import { requestSignup } from "@/server/services/signup";
import { signInWithPassword, LOGIN_ENABLED_ROLES } from "@/server/auth/staff";
import { getStore } from "@/lib/store";

let store: DataStore;

beforeEach(async () => {
  store = new DemoStore();
  setStoreForTests(store);
  await store.create("Staff", { email: "owner@test", name: "Owner", role: "owner", active: "TRUE" }, { actor: "test" });
});

describe("signup schema", () => {
  it("rejects the owner role — it is not self-selectable", () => {
    const r = signupInputSchema.safeParse({ email: "a@b.com", name: "Ann Test", password: "correct horse battery1", role: "owner" });
    expect(r.success).toBe(false);
  });

  it("accepts each non-owner role", () => {
    for (const role of ["sales", "operations", "accounts"]) {
      const r = signupInputSchema.safeParse({ email: "a@b.com", name: "Ann Test", password: "correct horse battery1", role });
      expect(r.success, role).toBe(true);
    }
  });

  it("requires a real email", () => {
    const r = signupInputSchema.safeParse({ email: "not-an-email", name: "Ann Test", password: "correct horse battery1", role: "sales" });
    expect(r.success).toBe(false);
  });
});

describe("requestSignup", () => {
  it("creates an inactive account that cannot sign in until approved", async () => {
    const result = await requestSignup({ email: "New.Hire@Royalcars.in", name: "New Hire", password: "correct horse battery1 staple1", role: "sales" });
    expect(result.ok).toBe(true);

    const attempt = await signInWithPassword("new.hire@royalcars.in", "correct horse battery1 staple1");
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("inactive");
  });

  it("can sign in once an owner approves it (flips active, same as Settings does)", async () => {
    const result = await requestSignup({ email: "approved@royalcars.in", name: "Approved Person", password: "correct horse battery1 staple1", role: "operations" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await getStore().get("Staff", result.id);
    expect(row).not.toBeNull();
    await getStore().update("Staff", result.id, { active: "TRUE" }, row!.version, { actor: "owner@test" });

    const attempt = await signInWithPassword("approved@royalcars.in", "correct horse battery1 staple1");
    expect(attempt.ok).toBe(true);
    if (attempt.ok) {
      expect(attempt.role).toBe("operations");
      expect(attempt.mustChangePassword).toBe(false);
    }
  });

  it("refuses a second request for an email that already exists", async () => {
    const first = await requestSignup({ email: "dup@royalcars.in", name: "First", password: "correct horse battery1 staple1", role: "sales" });
    expect(first.ok).toBe(true);
    const second = await requestSignup({ email: "dup@royalcars.in", name: "Second", password: "another good password1", role: "accounts" });
    expect(second.ok).toBe(false);
  });

  it("rejects a weak password before creating any row", async () => {
    const result = await requestSignup({ email: "weak@royalcars.in", name: "Weak", password: "short", role: "sales" });
    expect(result.ok).toBe(false);
    const attempt = await signInWithPassword("weak@royalcars.in", "short");
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("invalid"); // no such row was ever created
  });
});

describe("LOGIN_ENABLED_ROLES", () => {
  it("now admits every role — the approval flag is the real gate, not a role list", () => {
    expect(LOGIN_ENABLED_ROLES.sort()).toEqual(["accounts", "operations", "owner", "sales"].sort());
  });
});
