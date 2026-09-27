# Deployment

Everything below must be done by someone with admin rights on the Google
Workspace / Cloud project. Nothing in this repository has been run against a live
Google account; treat the first run as a real setup, on a spreadsheet that holds
no production data.

## 1. Google Cloud project

1. Create (or choose) a project at <https://console.cloud.google.com>.
2. **APIs & Services → Library** → enable:
   - Google Sheets API
   - Google Drive API
   - Apps Script API — needed for `scripts/deploy-gateway.ts` (§4); skip this
     one if you are using the manual gateway setup instead.

Sign-in is email/password against the `Staff` tab, not Google OAuth — there is
no client ID/secret to create here.

## 2. Service account (data access)

The app reads and writes Sheets and Drive as a service account, never as the
signed-in user.

1. **Credentials → Create credentials → Service account.**
2. Create a JSON key. **Store it outside the repository** (`.gitignore` already
   excludes `service-account*.json` and `secrets/`).
3. Point `GOOGLE_SERVICE_ACCOUNT_FILE` at that path, or supply the JSON through
   your host's secret manager and write it to a file at boot.
4. Note the service account address — `name@project.iam.gserviceaccount.com`.

> **Service accounts have no Drive storage quota of their own.** A file created
> by a service account in its own "My Drive" is effectively unreachable. Use a
> **shared drive** (below), or the upload will appear to work and leave you with
> files nobody can open.

## 3. Spreadsheet and Drive folders

1. Create a **shared drive** (Google Drive → Shared drives → New), e.g.
   "Showroom App Data".
2. Add the service account as a **Content manager** of that shared drive.
3. Inside it create the application spreadsheet and two folders,
   `Photos` and `Documents`.
4. Copy the ids out of the URLs:
   - spreadsheet → `GOOGLE_SHEETS_ID`
   - shared drive → `GOOGLE_DRIVE_ROOT_FOLDER_ID`
   - folders → `GOOGLE_DRIVE_PHOTO_FOLDER_ID`, `GOOGLE_DRIVE_DOC_FOLDER_ID`
5. Share the spreadsheet with the service account as **Editor**.

**Do not make the folders public.** The app proxies every file through
`/api/media/[fileId]` after checking the session, which is what keeps identity
documents private.

### Use a dedicated spreadsheet

Create a **new** spreadsheet for the application. Keep the client's original
sheet untouched as the migration source, and bring data across with the CSV
import (Settings → Import). `pnpm sheets:setup` only ever adds missing tabs and
writes headers into an **empty** header row; it never clears data. If a tab's
headers disagree with the schema it reports the mismatch and exits non-zero
without touching anything.

```bash
GOOGLE_SHEETS_ID=... GOOGLE_SERVICE_ACCOUNT_FILE=./secrets/sa.json pnpm sheets:setup
GOOGLE_SHEETS_ID=... GOOGLE_SERVICE_ACCOUNT_FILE=./secrets/sa.json pnpm sheets:validate
```

`sheets:validate` is read-only and safe to run any time, including from CI.

## 4. Serialized write gateway (required)

Without this, reservations, sales, sale payments, voiding a payment,
cancelling a sale, delivery, purchase payments and after-sale service charges
do not merely risk a race — **they fail outright** with "Write gateway is not
configured (GATEWAY_URL)." Every other write (acquisitions, inspections, work
orders, leads, commitments, service requests) does not go through this path
and is unaffected.

### Automated (preferred)

`scripts/deploy-gateway.ts` creates the container-bound Apps Script project,
pushes `apps-script/Gateway.gs`, sets the HMAC secret as a Script Property, and
creates the web app deployment — all via the Apps Script API
(`script.googleapis.com`), using the same service account already configured
for Sheets.

1. **Enable the Apps Script API** for your Cloud project (one-time, like
   Sheets/Drive): visit
   `https://console.cloud.google.com/apis/library/script.googleapis.com?project=<your-project-id>`
   and click Enable.
2. Run:
   ```bash
   npx tsx scripts/deploy-gateway.ts
   ```
   It prints the `GATEWAY_URL` and a freshly generated `GATEWAY_HMAC_SECRET` —
   set both in your environment. Re-run it after editing `Gateway.gs`; it
   detects the existing project and pushes a new version.

### Manual fallback

If the Apps Script API cannot be enabled (organisation policy, etc.):

1. Open the application spreadsheet → **Extensions → Apps Script**.
2. Replace the contents with `apps-script/Gateway.gs`. Save.
3. **Project Settings → Script properties** → add `HMAC_SECRET` with a strong
   random value (`openssl rand -base64 32`).
4. **Deploy → New deployment → Web app**
   - Execute as: **Me** (the spreadsheet owner)
   - Who has access: **Anyone** — requests are authenticated by HMAC signature,
     not by Google identity. The endpoint rejects anything unsigned.
5. Copy the `/exec` URL into `GATEWAY_URL`.
6. Set `GATEWAY_HMAC_SECRET` in the app environment to the **same** value as the
   script property.

Re-deploy (**Deploy → Manage deployments → Edit → New version**, or re-run
`scripts/deploy-gateway.ts`) whenever `Gateway.gs` changes, or the app and the
gateway will disagree about action semantics.

### Verifying the gateway

`pnpm test` runs `tests/gateway-parity.test.ts`, which executes the real
`Gateway.gs` source against a mocked Sheets API and asserts it matches the
in-app engine. Run it after any edit to that file. It verifies **semantics**, not
your deployment — for the deployment, make one reservation in the app and confirm
the row appears in the `Reservations` tab with `operationId` populated.

## 5. Environment

Copy `.env.example` to `.env` and fill in. For production, **unset `DEMO_MODE`**.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXTAUTH_URL` | yes | Public URL. Cookie security follows this scheme — https in production, or the session silently fails to persist |
| `NEXTAUTH_SECRET` | yes | `openssl rand -base64 32` |
| `GOOGLE_SHEETS_ID` | yes | The application spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | local only | Path to the JSON key, outside the repo |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | serverless only | The key itself, base64-encoded — use this on Vercel/Lambda, not the file path above |
| `GOOGLE_DRIVE_*_FOLDER_ID` | no | Shared-drive folders for photos/documents. Uploads are simply unavailable until set (stage 2, not yet in use) |
| `GATEWAY_URL` | yes | Apps Script `/exec` URL — see §4 |
| `GATEWAY_HMAC_SECRET` | yes | Must match the `HMAC_SECRET` script property. There is no fallback: unset, every critical write fails to sign |
| `DEMO_MODE` | no | `1` for the in-memory demo. **Never set in production** |

The first owner account is created with `pnpm staff:password -- --email <you> --role owner`
(see `scripts/staff-password.ts`), not an environment variable — there used to
be an `OWNER_EMAIL` variable for this and it was removed because nothing read
it; the CLI script replaced that path.

Two variables that used to appear here were removed as dead code, not just
undocumented: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` registered a Google
OAuth sign-in provider that no page ever linked to (there was no "Sign in
with Google" button anywhere), and `GATEWAY_TOKEN` was an alternate secret
that `Gateway.gs` never actually checked — the Apps Script side only ever
verified an HMAC signature. Worse, if neither was set the code silently
signed requests with the literal string `"insecure-dev"`. Both are gone; sign-in
is email/password only, and `GATEWAY_HMAC_SECRET` is required with no fallback.

Secrets belong in your host's secret manager. Never commit `.env`, and never put
credentials, passwords or session tokens in the spreadsheet.

## 6. First owner

```bash
pnpm staff:password -- --email you@yourcompany.in --name "Your Name" --role owner
```

This writes only a scrypt hash to the `Staff` tab and prints a temporary
password once — it is not stored anywhere and cannot be shown again. Sign in
with it, then add the rest of the staff from **Settings → Staff**, or have
them request an account at `/signup` and approve it yourself from there.

Sign-in is allowlist-only either way: `signInWithPassword` refuses any account
absent from the `Staff` tab or with `active` set to `FALSE`.

To lock someone out, set their `active` to `FALSE` from Settings → Staff (the
Deactivate button does this). This takes effect on their very next request —
`assertAccountActive` re-checks it on every call, not just at sign-in, so a
session that was already open is cut off immediately rather than continuing
to work for the rest of its 12-hour lifetime.

## 7a. Deploying to Vercel

Vercel has no writable disk, so `GOOGLE_SERVICE_ACCOUNT_FILE` cannot work there.
Pass the key itself instead, base64-encoded so the newlines in the private key
survive the dashboard:

```bash
base64 -i secrets/service-account.json | tr -d '\n'
```

Paste the result as `GOOGLE_SERVICE_ACCOUNT_JSON`. Raw JSON also works; base64 is
simply harder to corrupt. Inline JSON takes precedence over a file, so a stale
key baked into an image can never win.

**Required — the app will not run correctly without these:**

| Variable | Value | Scope |
| --- | --- | --- |
| `NEXTAUTH_URL` | `https://<your-app>.vercel.app` — must be `https://`, no trailing slash | Production |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | All |
| `GOOGLE_SHEETS_ID` | The spreadsheet id | All |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The base64 above | All |
| `GATEWAY_URL` | from `scripts/deploy-gateway.ts` or the manual setup in §4 | All |
| `GATEWAY_HMAC_SECRET` | same script; must match the deployed script's `HMAC_SECRET` property | All |

**Optional — only if you're using photo/document uploads (not required to run):**

| Variable | Value |
| --- | --- |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | shared drive id |
| `GOOGLE_DRIVE_PHOTO_FOLDER_ID` | photos folder id |
| `GOOGLE_DRIVE_DOC_FOLDER_ID` | documents folder id |

**Must NOT be set on Vercel:**

| Variable | Why |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | there is no disk to put the file on — this caused every route to 500 the first time this was deployed; use `GOOGLE_SERVICE_ACCOUNT_JSON` instead |
| `DEMO_MODE` | any value serves in-memory fictional data instead of your real spreadsheet |

Until `GATEWAY_URL`/`GATEWAY_HMAC_SECRET` are set, reservations, sales, sale
payments, cancellations, delivery, purchase payments and after-sale charges
fail outright with "Write gateway is not configured" — not merely
unserialized. Everything else (acquisitions, inspections, work orders, leads,
CRM, after-sale commitments/requests, settings, staff, signup/approval) works
without it.

Redeploy after changing any variable: Vercel bakes them in at build time.

## 7. Deploying the app

Any Node host that runs Next.js 15 (Vercel, Cloud Run, a VM):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Requirements: Node 20+, all environment variables set, and the service-account
JSON readable by the process. Serverless platforms need the key written from a
secret at boot rather than shipped in the image.

## Backup and restore

**CSV exports are not a backup of Drive files.** The two need separate handling.

### Data (Sheets)

- *Automatic:* Google Sheets keeps full version history — File → Version history.
  This covers accidental edits and is the fastest way back.
- *Scheduled:* copy the spreadsheet weekly (File → Make a copy, into a dated
  backup folder) or via a scheduled script. Keep 8 weekly copies.
- *Portable:* Reports → export CSVs for inventory and sales. Good for auditors,
  incomplete as a restore source — it omits audit history and file metadata.

**Restore:** make a copy of the backup spreadsheet, run `pnpm sheets:validate`
against it, point `GOOGLE_SHEETS_ID` at it, restart, then run `pnpm sheets:audit`
and review. Do not restore into a live spreadsheet.

### Files (Drive)

- Photos and documents live in the shared drive, not in the spreadsheet.
- Use Google Takeout or Drive for desktop to copy the Photos and Documents
  folders on the same schedule as the spreadsheet.
- File metadata (in `VehiclePhotos` / `VehicleDocuments`) and the files must be
  restored **together**; restoring one alone leaves records pointing at files
  that do not exist. `pnpm sheets:audit` reports those.

## Quotas and rate limits

Google Sheets API: 300 read requests/minute per project and 60 per user per
minute; Drive has separate limits. The app batches reads, caches for 15 seconds
and retries with exponential backoff and jitter. On sustained 429s staff see a
"busy, try again" message rather than a corrupted write.

Apps Script adds its own limits: a script lock held up to 30 seconds per request,
and Script Properties capped around 500 KB in total (the gateway prunes
idempotency markers older than 7 days).

If the showroom outgrows this — sustained concurrent use by many staff, or tens
of thousands of rows — the repository/store boundary is where a real database
would be swapped in, without touching the service layer.

## Operational checks

| Task | Command | When |
| --- | --- | --- |
| Schema check | `pnpm sheets:validate` | After any manual sheet edit; weekly |
| Reconciliation | `pnpm sheets:audit` | Weekly; after any incident |
| Gateway parity | `pnpm test` | After editing `Gateway.gs` |

`sheets:audit` reports duplicate ids, broken references, invalid amounts and
incomplete operations. It is read-only and never repairs anything by itself.
