# Decisions

Each entry: what was decided, why, and what it costs. Newest first.

## Store password hashes in the Staff tab

The brief said no passwords in Sheets. The showroom wants email/password sign-in
rather than Google OAuth. Storing a **scrypt hash** honours the intent — no
password is stored — while delivering the feature.
**Cost:** anyone who can read the spreadsheet can attempt an offline attack.
Mitigated by memory-hard hashing, per-password salts and a password policy. See
[SECURITY.md](SECURITY.md#known-risk-hashes-live-in-a-spreadsheet).

## Forms accept partial records

Staff are entering history they already hold on paper, and it has gaps.
Refusing the save loses the information entirely.
**Cost:** records can be sparse. Mitigated by two minimums (a person needs a name
or phone; a car needs a registration, make or model) and by storing unknown
numbers blank rather than `0`.
**Required first:** customer matching had to stop matching on an empty phone, or
every customer without a number would have merged into one record.

## Radix primitives, not a component library

Already committed to Tailwind. Radix supplies behaviour and accessibility —
focus traps, dismiss layers, ARIA — and nothing else, so there is no second
styling system and no runtime CSS-in-JS.
**Cost:** we own the wrapper code, so new components are not free.
**Rejected:** MUI and Chakra (Emotion runtime, conflicts with Tailwind), Ant
Design (heavy, opinionated), Mantine (own styling system).

## Native form controls, not Radix Select

A native `<select>` opens the OS picker on a phone, which beats any custom
listbox on the showroom floor.
**Revisit** when vehicle and customer lists get long enough to need type-ahead.

## Route `loading.tsx` despite soft 404s

Every page is dynamic and reads Sheets, so without a skeleton the browser shows
the *previous* page until the server responds — which reads as a broken link.
**Cost:** `loading.tsx` makes the route stream, so headers are sent before
`notFound()` runs and a missing record returns **200** with the correct page.
Measured both ways. Acceptable for an authenticated tool with no SEO surface;
delete `loading.tsx` to get the 404 back.

## Navigation follows the car, not the software

"Acquisitions / Inventory / CRM" made staff translate their process into our
module names. Grouping is now Buying · Preparing · Selling · After sale · Money.

## Money as integer paise

Floating-point rupees accumulate error across repairs, part payments and
refunds. Every amount is an integer of the smallest unit.
**Cost:** every boundary must convert. `moneyInput` does it once, at parse time,
and the transform is deliberately not idempotent — so input is parsed exactly
once, at the API boundary.

## One schema definition, used by both form and route

Client and server schemas had already drifted: the settings route silently
dropped four fields, and an `email().optional().default("")` rejected both `""`
and `undefined`, making the field impossible to leave blank.
`src/lib/form-schemas.ts` is now the only definition; services re-export it.

## Declarative critical writes

Sheets has no transactions. Expressing a critical section as data
(`CriticalAction[]`) lets the same plan run under an in-process mutex in demo and
under an Apps Script lock in production.
**Cost:** two engines that must agree — so `tests/gateway-parity.test.ts` runs
the same plans through both and asserts identical results.

## Google Sheets as the store

Client requirement. It is not a database: no transactions, no indexes, quota
limits, and the owner can edit it directly.
**Cost, stated honestly:** every query is a full-tab read, so reads are batched
and cached for 15s; critical writes need a shared lock; manual edits bypass
validation and audit, and are detected by `pnpm sheets:audit`, not prevented.
