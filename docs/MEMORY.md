# Memory — context worth keeping

Things a newcomer (or a future session) would otherwise have to rediscover.

## Live environment

- **Spreadsheet:** "Royal Cars — App Data". The id is in `.env`
  (`GOOGLE_SHEETS_ID`), which is gitignored — this repository is public, so
  infrastructure identifiers are deliberately not written down here.
- **Google project and service account:** see `.env` and
  `secrets/service-account.json`. `pnpm sheets:check` prints the service-account
  address when you need it for sharing.
- 32 tabs created and validated; 51 rows of fictional seed data loaded.
- **The app still runs in demo mode** — `.env.local` has `DEMO_MODE=1`, which
  takes precedence over `.env` in Next.js. Scripts read `.env` directly.

## Outstanding, and important

1. **The service-account key was exposed during setup.** Delete the existing key
   in Cloud Console (Service accounts → Keys) and issue a new one before any real
   data goes in. Deleting revokes it instantly.
2. **The Apps Script gateway is not deployed.** Critical writes are therefore
   not serialized in production.
3. **Drive is not configured.** Uploads need a *shared drive* — a service account
   has no storage quota of its own, so files created in its own Drive are
   unreachable while appearing to succeed.

## Bugs that only appeared against real Google

Worth remembering, because demo mode cannot catch this class:

- `ensureTable` read range `A1:A1` — the single cell, not the header row — then
  compared it to all 44 expected columns. **No update could ever succeed.**
  Creates slipped through because they do not call it.
- `sheets:validate` fired 32 sequential reads and blew the 60-per-minute quota,
  reporting a false failure. Now one `batchGet`.

## Bugs that hid behind passing tests

- Page content was server-rendered at `opacity: 0` and only revealed on
  hydration, so every page was blank until JS loaded. Navigation tests passed
  because they asserted the URL and heading *text*, which exist in the DOM while
  invisible. **Assert visibility, not presence.**
- `afterSaleCosts` filtered `ServiceJobs` by `j.payer` — a column that does not
  exist on that tab — so showroom-funded after-sale work always totalled zero.
- Ten components defaulted dates with `new Date().toISOString().slice(0,10)`,
  which is the **UTC** date. Between 00:00 and 05:30 IST every date field
  pre-filled yesterday. Use `todayDateOnly()`.

## Conventions that are easy to get wrong

- Money is **integer paise**; `moneyInput` parses once, at the API boundary, and
  is **not** idempotent — never parse twice.
- Business dates are IST date-only strings; timestamps are ISO UTC.
- `repo.table("…")` takes a typed `TableName`, so a typo is a compile error.
- Mono type is opt-in (`.tabular`, `.ref`), never applied to whole cells.
- Red means primary action, error, or money owed. Focus rings are `slate-900`.

## Local commands

```
pnpm dev                      # demo mode, in-memory data
pnpm sheets:check             # preflight the Google connection
CONFIRM_RESET=yes pnpm sheets:reset   # clear data rows, keep headers
pnpm staff:password -- --email you@royalcars.in --role owner
```

`pnpm build` now refuses to run while a dev server is up, because both write to
`.next`: a build overwrites the chunks dev is serving and the browser then fails
with `Cannot read properties of undefined (reading 'call')` from webpack.js. The
build succeeds, so the damage only shows on the next reload.

If you hit it (or any other odd build state): `pnpm clean` stops dev servers and
removes `.next`. Override the guard deliberately with `ALLOW_BUILD_WITH_DEV=1`.

Also watch for **two** dev servers on port 3000 — starting a second one while the
first is alive produces the same corruption. `pnpm clean` clears both.

## Demo sign-in

`owner@royalcars.demo` / `Showroom-Demo-2026`. Sign-in is limited to **owner**
accounts (`LOGIN_ENABLED_ROLES` in `src/server/auth/staff.ts`).
