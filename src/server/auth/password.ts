import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * Password hashing for staff sign-in.
 *
 * The showroom's staff list lives in the Settings spreadsheet, so whatever is
 * stored there is visible to everyone the sheet is shared with, survives in
 * version history and lands in any CSV export. A password must therefore never
 * be stored — only a one-way hash that is expensive to attack offline.
 *
 * scrypt is used because it is memory-hard (so GPUs help an attacker far less
 * than with SHA-family hashes) and ships with Node, adding no dependency to
 * audit. Each password gets its own 16-byte random salt, so identical passwords
 * produce different hashes and one cracked password reveals nothing about
 * another.
 *
 * Stored format: `scrypt$N$r$p$<salt base64>$<hash base64>`. The parameters are
 * recorded alongside the hash so they can be raised later without invalidating
 * existing passwords.
 */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const SALT_BYTES = 16;

export const PASSWORD_MIN_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  const problem = describePasswordProblem(password);
  if (problem) throw Object.assign(new Error(problem), { status: 400 });
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed or empty stored value, so a
 * staff row with no password set simply cannot sign in.
 */
export async function verifyPassword(password: string, stored: string | undefined | null): Promise<boolean> {
  if (!stored || !password) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, , saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashB64 as string, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  try {
    const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64 as string, "base64"), expected.length);
    // Constant-time: a plain === leaks how much of the hash matched via timing.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Human-readable reason a password is unacceptable, or null when it is fine. */
export function describePasswordProblem(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 200) return "That password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  const tooObvious = ["password", "royalcars", "12345678", "qwerty", "admin"];
  const lower = password.toLowerCase();
  if (tooObvious.some((t) => lower.includes(t))) {
    return "That password is too easy to guess.";
  }
  return null;
}

/** A readable temporary password for handing to a new staff member. */
export function generateTemporaryPassword(): string {
  // Ambiguous characters (0/O, 1/l/I) are excluded so it can be read aloud.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}
