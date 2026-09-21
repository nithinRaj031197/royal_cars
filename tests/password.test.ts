/**
 * Password hashing. These are the properties that matter if the spreadsheet
 * holding the staff list is ever seen by someone who should not see it.
 */
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  describePasswordProblem,
  generateTemporaryPassword,
  PASSWORD_MIN_LENGTH
} from "@/server/auth/password";

describe("password hashing", () => {
  it("never stores the password itself", async () => {
    const secret = "showroom-Nithin-2026";
    const stored = await hashPassword(secret);
    expect(stored).not.toContain(secret);
    expect(stored.startsWith("scrypt$")).toBe(true);
    // Parameters travel with the hash so they can be raised later.
    expect(stored.split("$")).toHaveLength(6);
  });

  it("accepts the right password and rejects everything else", async () => {
    const stored = await hashPassword("showroom-Nithin-2026");
    expect(await verifyPassword("showroom-Nithin-2026", stored)).toBe(true);
    expect(await verifyPassword("showroom-nithin-2026", stored)).toBe(false);
    expect(await verifyPassword("showroom-Nithin-2027", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts each password, so identical passwords hash differently", async () => {
    const a = await hashPassword("showroom-Nithin-2026");
    const b = await hashPassword("showroom-Nithin-2026");
    expect(a).not.toBe(b);
    // Both still verify: the salt travels with the hash.
    expect(await verifyPassword("showroom-Nithin-2026", a)).toBe(true);
    expect(await verifyPassword("showroom-Nithin-2026", b)).toBe(true);
  });

  it("refuses to sign in a staff row that has no password set", async () => {
    expect(await verifyPassword("anything at all", "")).toBe(false);
    expect(await verifyPassword("anything at all", undefined)).toBe(false);
    expect(await verifyPassword("anything at all", "not-a-hash")).toBe(false);
    // A truncated or tampered record must not become a way in.
    expect(await verifyPassword("anything at all", "scrypt$16384$8$1$$")).toBe(false);
  });

  it("rejects weak passwords before they are ever stored", async () => {
    expect(describePasswordProblem("short1")).toMatch(new RegExp(`${PASSWORD_MIN_LENGTH} characters`));
    expect(describePasswordProblem("alllettersonly")).toMatch(/letter and one number/);
    expect(describePasswordProblem("password12345")).toMatch(/easy to guess/);
    expect(describePasswordProblem("RoyalCars2026x")).toMatch(/easy to guess/);
    expect(describePasswordProblem("Showroom2026x")).toBeNull();
    await expect(hashPassword("weak")).rejects.toThrow();
  });

  it("generates temporary passwords that pass the policy and differ each time", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    expect(a).not.toBe(b);
    expect(describePasswordProblem(a.replace(/-/g, "") + "1")).toBeNull();
  });
});
