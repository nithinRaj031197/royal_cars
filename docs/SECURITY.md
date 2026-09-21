# Security

## Authentication

- **Email and password**, checked against the `Staff` tab.
- Passwords are **never stored**. Only a scrypt hash is written:
  `scrypt$N$r$p$<salt>$<hash>`, 16-byte random salt per password, parameters
  stored alongside so they can be raised later without invalidating anything.
- Comparison is constant-time (`timingSafeEqual`).
- Policy: 10+ characters, at least one letter and one number, common strings
  rejected.
- **5 failed attempts locks the account for 15 minutes.**
- Every failure returns the same message, so the form cannot be used to discover
  which addresses are staff.
- **No self sign-up.** Accounts exist because an owner ran `pnpm staff:password`.
- Sign-in is currently limited to **owner** (`LOGIN_ENABLED_ROLES`).

### Known risk: hashes live in a spreadsheet

This is a deliberate deviation from the original brief, which said no passwords
in Sheets. A one-way hash is not a password, but anyone who can read the
spreadsheet can attempt an **offline** attack on it. Mitigations:

- scrypt is memory-hard, so the attack is slow and GPUs help far less than with
  SHA-family hashes;
- per-password salts mean one cracked password reveals nothing about another;
- the password policy blocks the candidates such an attack tries first.

Keep the spreadsheet shared with as few people as possible, and prefer Google
sign-in for anyone who has a Google account.

## Authorisation

- Enforced **on the server** for every read, write, export and file request.
- Four roles with explicit permission lists (`src/lib/permissions.ts`).
- Confidential figures — purchase price, minimum price, investment, margin — are
  gated by `purchase.view` and `profit.view`.
- Customer-facing documents are built from **allowlists**, so confidential
  fields are never fetched into those pages and cannot leak through markup.
  Asserted by tests.

## Files

- Drive folders are never public. Files stream through `/api/media/[fileId]`
  after a session check.
- A file is served only when the app holds a metadata row for it, so a staff
  session cannot be used to walk the service account's Drive by guessing ids.
- Documents marked `sensitive` (identity scans) additionally require
  `document.sensitive`, which operations staff do not have.

## Secrets

- The service-account key lives in `secrets/`, gitignored, mode `600`.
- `.env` and `.env.local` are gitignored.
- **Never paste a private key into chat, a ticket or a screenshot.** If one is
  exposed, delete the key in Cloud Console — that revokes it instantly — and
  issue a new one.
- Git history was scanned for key material before the first push.

## Data handling

- Identity numbers are stored **masked**; full scans are attachments marked
  sensitive.
- Audit entries record actor, entity, action, timestamp and operation id.
- Error responses never leak internals: validation failures return a 400 naming
  the field; genuine faults return a generic message and log the detail.
- CSV exports escape formula-injection prefixes (`=`, `+`, `-`, `@`).

## Residual risks, stated plainly

| Risk | Status |
| --- | --- |
| Password hashes readable by anyone with sheet access | Accepted, mitigated above |
| Spreadsheet owner can edit data directly, bypassing validation and audit | Unavoidable; `pnpm sheets:audit` detects damage |
| Critical writes not serialized until the Apps Script gateway is deployed | **Open** — see DEPLOYMENT.md stage 3 |
| Service-account key exposed during setup | **Must be rotated** |
