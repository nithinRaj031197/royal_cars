# Tasks

## Done

- [x] Schema registry: 32 tabs, 663 columns, typed `TableName` union
- [x] Store abstraction with an in-memory demo store and a Sheets store
- [x] Declarative critical writes (`assert`, `assert-field`, `assert-sum`, `$ref`)
- [x] Apps Script gateway, with automated parity tests against the real source
- [x] Acquisition, inspection, work, accessories, expenses, pricing
- [x] CRM, reservations, sales, payments, delivery
- [x] After-sale commitments, service requests, customer-billable charges
- [x] Per-car money trail (`/ledger`) — seller → showroom → customer
- [x] Reports, CSV import/export with formula-injection protection
- [x] Customer-facing copies from allowlisted projections
- [x] Role-based permissions enforced server-side
- [x] Radix + Tailwind component library, Royal Cars theme, three fonts
- [x] Per-field help popovers for all 116 fields
- [x] Route loading / error / not-found boundaries
- [x] Email + password sign-in with scrypt hashes and lockout
- [x] Google Sheets connected, 32 tabs created and validated, demo data seeded
- [x] Self sign-up + owner approval (`/signup`, Settings → Staff Approve/Deactivate) —
  reuses the existing `active` flag, no schema change
- [x] Sign-in opened to all four roles — the approval flag is now the gate,
  not a blanket role restriction (`LOGIN_ENABLED_ROLES`)
- [x] Dead code removed: Google OAuth sign-in provider (never had a UI path),
  `GATEWAY_TOKEN` (an insecure fallback that Gateway.gs never actually
  checked), `OWNER_EMAIL` (unread by anything)
- [x] `scripts/deploy-gateway.ts` — deploys the Apps Script gateway
  end-to-end via the Apps Script API, no manual web-UI steps once the API
  is enabled once per Cloud project

## Next — in order

1. **Enable the Apps Script API, then run `pnpm gateway:deploy`.** This is
   the one remaining manual step blocking reservations, sales, payments and
   delivery against real Sheets — see docs/DEPLOYMENT.md §4. One click:
   https://console.cloud.google.com/apis/library/script.googleapis.com
2. **Rotate the service-account key.** It was exposed during setup.
3. **Switch the app to Sheets** — remove `DEMO_MODE=1` from `.env.local` and
   verify each screen against live data.
4. **Drive setup** (stage 2) — shared drive plus photo/document folders, then
   verify a real upload and a 403 for a role without `document.sensitive`.
5. **Password change screen** — `mustChangePassword` is stored but not yet acted
   on in the UI.

## Later

- Mobile card layouts for the dense list tables (currently a scrolling table
  with a sticky first column)
- Searchable vehicle/customer pickers (`@radix-ui/react-select` + `cmdk`)
- Charts in Reports (`recharts`)
- Public website, using the projection that already exists
- Measure real dataset limits; current figures are design targets, not benchmarks
