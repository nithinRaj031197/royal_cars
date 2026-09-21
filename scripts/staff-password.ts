/**
 * Creates a staff account or sets its password.
 *
 * There is no self sign-up: accounts exist only because an owner made one.
 *
 *   pnpm staff:password -- --email owner@royalcars.in --name "Priya" --role owner
 *   pnpm staff:password -- --email arun@royalcars.in --password 'chosen-password'
 *
 * With no --password a readable temporary one is generated and printed once.
 * Only the scrypt hash is written to the spreadsheet; the password itself is
 * never stored anywhere.
 */
import { getStore } from "../src/lib/store";
import { hashPassword, describePasswordProblem, generateTemporaryPassword } from "../src/server/auth/password";
import { isRole, type Role } from "../src/lib/permissions";
import { todayISO } from "../src/lib/dates";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm staff:password -- --email <address> [--name <name>] [--role owner|sales|operations|accounts] [--password <password>]");
    process.exit(1);
  }

  const roleArg = arg("role") ?? "owner";
  if (!isRole(roleArg)) {
    console.error(`Unknown role "${roleArg}". Use owner, sales, operations or accounts.`);
    process.exit(1);
  }
  const role = roleArg as Role;

  const generated = !arg("password");
  const password = arg("password") ?? generateTemporaryPassword() + "1";
  const problem = describePasswordProblem(password);
  if (problem) {
    console.error(`That password is not acceptable: ${problem}`);
    process.exit(1);
  }

  const store = getStore();
  const ctx = { actor: "cli:staff-password" };
  const passwordHash = await hashPassword(password);

  const staff = await store.list("Staff", { activeOnly: false });
  const existing = staff.find((s) => (s.email ?? "").trim().toLowerCase() === email);

  if (existing) {
    await store.update(
      "Staff",
      existing.id,
      {
        passwordHash,
        passwordSetAt: todayISO(),
        mustChangePassword: generated ? "TRUE" : "FALSE",
        failedAttempts: "0",
        lockedUntil: "",
        ...(arg("name") ? { name: arg("name")! } : {}),
        ...(arg("role") ? { role } : {})
      },
      existing.version,
      ctx
    );
    console.log(`Updated password for ${email} (${arg("role") ? role : existing.role}).`);
  } else {
    await store.create(
      "Staff",
      {
        email,
        name: arg("name") ?? email.split("@")[0]!,
        role,
        active: "TRUE",
        phone: "",
        googleSub: "",
        lastLoginAt: "",
        passwordHash,
        passwordSetAt: todayISO(),
        mustChangePassword: generated ? "TRUE" : "FALSE",
        failedAttempts: "0",
        lockedUntil: ""
      },
      ctx
    );
    console.log(`Created ${email} as ${role}.`);
  }

  if (generated) {
    console.log(`\n  Temporary password: ${password}`);
    console.log("  Give this to them directly. It is not stored and cannot be shown again.\n");
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
