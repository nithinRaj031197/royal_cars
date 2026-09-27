# Sheets end-to-end test kit

Runs the full car lifecycle against the **real Google Sheets datastore**
instead of the demo store, then proves nothing was left behind.

Every record this creates carries a run tag (`CYTEST-<timestamp>`), so
`verify.ts` and `cleanup.ts` can find exactly what a run touched and nothing
else. `cleanup.ts` deletes rows by descending row number per tab so an
earlier deletion never shifts a later target.

## Running it

Requires real Sheets credentials — this is not the demo store.

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON=$(base64 -i secrets/service-account.json | tr -d '\n')
export GOOGLE_SHEETS_ID=<your spreadsheet id>

# 1. baseline — record row counts before the run
pnpm e2e:sheets:snapshot > /tmp/baseline.json

# 2. start the app pointed at Sheets (separate terminal)
NEXTAUTH_SECRET=<something> pnpm e2e:sheets:server

# 3. run the journey (needs an owner account that already exists in Staff)
CYPRESS_TESTTAG=CYTEST-$(date +%s) \
CYPRESS_OWNER_EMAIL=<owner email> \
CYPRESS_OWNER_PASSWORD=<owner password> \
pnpm e2e:sheets:run

# 4. confirm what got written, then remove exactly that
pnpm e2e:sheets:verify
pnpm e2e:sheets:cleanup            # dry run — prints the plan
pnpm e2e:sheets:cleanup -- --apply # deletes

# 5. confirm the sheet is back to baseline
pnpm e2e:sheets:snapshot > /tmp/after.json
diff /tmp/baseline.json /tmp/after.json   # should be empty
```

## Known constraints

- **Sheets enforces a per-minute read/write quota per user.** The journey
  spec paces itself with short waits between steps; running it back-to-back
  without a pause between runs can still trip the quota. `withRetry` in
  `google-sheets.ts` backs off in seconds (not milliseconds) specifically for
  this, but a quota is still a quota.
- **The write gateway (`GATEWAY_URL`) must be deployed** for any critical
  write — reservations, sales, payments, delivery — to succeed against
  Sheets. Without it every one of those calls fails with "Write gateway is
  not configured (GATEWAY_URL)."; acquisitions, inspections and work orders
  do not go through the critical path and are unaffected.
- This kit does not touch CSV import or media/photo upload, by design.
