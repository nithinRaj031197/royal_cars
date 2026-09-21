# Royal Cars

Administration portal for a small-to-medium pre-owned car showroom. It follows a
vehicle from the first seller enquiry through inspection, acquisition,
refurbishment, pricing, sale, delivery and after-sale support — with Google
Sheets as the operational data store and Google Drive for photos and documents.

This phase is the **admin portal only**. There is no public website: the fields
and the allowlisted projection a public site would need exist, but no public
pages are served.

## Status

| | |
| --- | --- |
| Typecheck | `tsc --noEmit` clean |
| Lint | `eslint .` clean — 0 errors, 0 warnings |
| Tests | 39 passing (`pnpm test`) |
| Production build | succeeds |
| Demo mode | verified end to end with fictional data |
| Google Sheets / Drive | **code complete, not verified against live Google credentials** — see [Honest limitations](#honest-limitations) |

## Quick start (demo mode — no Google account)

```bash
pnpm install
cp .env.example .env.local     # keep DEMO_MODE=1
pnpm dev                       # http://localhost:3000
```

Demo mode keeps everything in memory and seeds a fictional showroom on first
request, so there is a complete lifecycle to look at immediately. Sign in by
picking a profile — no password, no Google account:

| Profile | Role | Sees |
| --- | --- | --- |
| `owner@royalcars.demo` | Owner/Admin | Everything, including cost and margin |
| `sales@royalcars.demo` | Sales | Leads, customers, reservations, sales. **No** purchase price or profit |
| `ops@royalcars.demo` | Operations | Inspections, work orders, inventory, delivery |
| `accounts@royalcars.demo` | Accounts | Payments, expenses, financial reports |

### Where to look first

| View | URL | What it is |
| --- | --- | --- |
| Admin | `/dashboard` | The daily working view, role-aware |
| **Car money trail** | `/ledger` | **Every rupee per car: seller → showroom → customer** |
| Staff | `/dashboard` signed in as a non-owner | The same app with permissions applied — sign in as `sales@royalcars.demo` and compare a vehicle's Money summary |
| Customer | `/customer` | Printable customer copies: sale documents and vehicle detail sheets |

### Navigation follows the car, not the software

The sidebar is grouped by the journey a vehicle actually takes, because that is
how the showroom thinks about it:

| Group | Covers |
| --- | --- |
| **Seller → Showroom** | Seller enquiries, cars we own |
| **In the showroom** | Inspections & work, vendors & expenses |
| **Showroom → Customer** | Leads & customers, sales & delivery, customer copies |
| **After the sale** | Service & support |
| **Money** | Car money trail, reports, settings |

`/ledger` is the view that answers "what has this car cost us, and where does it
stand?" in one page: what was agreed with the seller and what is still owed, every
repair, accessory and expense (including the ones deliberately *not* counted, and
why), what it sold for, what the customer still owes, and the contribution after
showroom-funded after-sale work.

The seeded data contains `STK-00001` (a Swift taken all the way through sale,
delivery and a covered after-sale repair), `STK-00002` (an i20 under
preparation) and a rejected Honda City enquiry that stays searchable without
entering inventory.

## Commands

```bash
pnpm dev              # development server
pnpm build            # production build
pnpm test             # vitest suite
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint (next/core-web-vitals + next/typescript)
pnpm sheets:setup     # create/validate tabs and headers (never destructive)
pnpm sheets:validate  # read-only schema check
pnpm sheets:seed      # write the fictional dataset
pnpm sheets:audit     # reconciliation report
pnpm schema:export    # regenerate DATA_DICTIONARY.md from the registry
```

## Documentation

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers, the write gateway, concurrency, caching, what Sheets cannot do |
| [DATA_DICTIONARY.md](DATA_DICTIONARY.md) | Every tab and column (generated) |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Day-to-day use, for showroom staff |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Google setup, secrets, backups, restore, quotas |
| [ASSUMPTIONS.md](ASSUMPTIONS.md) | Business decisions made where the brief was silent |

## How money is handled

All amounts are integer **paise**; no floating-point rupees anywhere.

```
Pre-sale investment = purchase price
                    + posted actual costs of completed, showroom-paid work orders
                    + accessories not already billed inside a work order
                    + other showroom-paid vehicle expenses

Gross vehicle profit = final net sale price − pre-sale investment
```

Gross vehicle profit is **not** business net profit: it excludes general
overhead. Customer receipts are cash flow and never change the sale price or the
profit figure. Each posted amount has exactly one canonical source, so an
accessory billed inside a work order invoice is not counted a second time.

## Honest limitations

- **Google Sheets and Drive are not verified against live credentials.** The
  integration is complete and typechecked, and the Apps Script gateway is
  executed by an automated parity test (`tests/gateway-parity.test.ts`) that runs
  the real `Gateway.gs` source against a mocked Sheets API. That proves the
  action semantics match the app. It does **not** prove that your spreadsheet,
  service account and Drive permissions are correct — only running
  `pnpm sheets:setup` and `pnpm sheets:validate` against your own Google project
  can do that. Nothing here has been run against a real Google account.
- **Sheets is not a database.** There are no transactions and no indexes. See
  [ARCHITECTURE.md](ARCHITECTURE.md#what-google-sheets-cannot-do) for what that
  costs you and how the app compensates.
- **Tested dataset size.** The demo dataset is small (3 vehicles). The design
  targets roughly 800 vehicles and 10,000 rows per tab; those figures are design
  targets, **not** measured benchmarks.
- **Manual spreadsheet edits bypass the application.** They skip validation and
  audit history. `pnpm sheets:audit` finds the damage; it cannot prevent it.
- **CSV exports do not back up Drive files.** Data and files need separate backup
  procedures — both are described in [DEPLOYMENT.md](DEPLOYMENT.md#backup-and-restore).

## Tech

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · **Radix UI
primitives (shadcn/ui style)** · React Hook Form + Zod · NextAuth (Google) ·
googleapis · Framer Motion · Vitest.

Type: **Geist** for interface text, **Fraunces** for page titles and the
wordmark, **Geist Mono** for money and references — all self-hosted variable
fonts via `next/font`.

No monolithic component library: Radix supplies accessible behaviour, Tailwind
supplies styling, and the wrappers in `src/components/ui/` are ours to edit. See
[ARCHITECTURE.md](ARCHITECTURE.md#ui-foundation) for why, and for how the
per-field help popovers work.
