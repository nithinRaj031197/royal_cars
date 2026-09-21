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

## Next — in order

1. **Rotate the service-account key.** It was exposed during setup.
2. **Deploy the Apps Script gateway** (DEPLOYMENT.md stage 3). Until then,
   concurrent payments are not serialized in production.
3. **Switch the app to Sheets** — remove `DEMO_MODE=1` from `.env.local` and
   verify each screen against live data.
4. **Drive setup** (stage 2) — shared drive plus photo/document folders, then
   verify a real upload and a 403 for a role without `document.sensitive`.
5. **Open sign-in to other roles** — widen `LOGIN_ENABLED_ROLES` once the sales,
   operations and accounts screens are finished.
6. **Password change screen** — `mustChangePassword` is stored but not yet acted
   on in the UI.

## Later

- Mobile card layouts for the dense list tables (currently a scrolling table
  with a sticky first column)
- Searchable vehicle/customer pickers (`@radix-ui/react-select` + `cmdk`)
- Charts in Reports (`recharts`)
- Public website, using the projection that already exists
- Measure real dataset limits; current figures are design targets, not benchmarks
