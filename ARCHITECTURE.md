# Architecture

## Request path

```
Admin browser
    │  session cookie (NextAuth, JWT, httpOnly)
    ▼
Next.js server  ── permission check ──► service layer ──► repository ──► store
 (App Router)      (every route)         (business rules)   (typed)      │
                                                                         ├─► Google Sheets API   (reads, non-critical writes)
                                                                         ├─► Apps Script gateway (critical writes, shared lock)
                                                                         └─► Google Drive API    (files)
```

The browser never receives Google credentials and never talks to Google
directly. Files are proxied through `/api/media/[fileId]` so Drive folders stay
private.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `src/app/(app)/**` | Server components; render only what the role may see |
| API routes | `src/app/api/**` | `withPermission(...)` wrapper, Zod body parsing, safe errors |
| Services | `src/server/services/**` | Business rules, money maths, state machines, audit |
| Repository | `src/lib/repo` | Typed table access; keeps sheet ranges out of business logic |
| Store | `src/lib/store/**` | `DataStore` interface: Google Sheets or the in-memory demo store |
| Schemas | `src/lib/form-schemas.ts` | **One** definition per input, used by both forms and routes |

### One schema, both sides

`src/lib/form-schemas.ts` is the single source of truth for every input shape.
Client forms use it through `zodResolver`; API routes use the same object through
`parseBody`. Services import and re-export from it rather than redefining, so
client and server validation cannot drift apart.

Services accept `ServiceInput<typeof schema>` — the schema's *output* type (money
already in paise) with defaulted fields left optional. A route passes a fully
parsed object; server code and tests can omit defaults. Input is parsed exactly
once, at the boundary, because the money transform is not idempotent.

## UI foundation

There is no monolithic component library. The stack is **Tailwind CSS for
styling + Radix UI primitives for behaviour**, assembled in the shadcn/ui style:
primitives are wrapped in our own thin components under `src/components/ui/`,
whose source we own outright.

Why this rather than MUI, Chakra, Ant Design or Mantine:

| Concern | This stack | Runtime-styled libraries |
| --- | --- | --- |
| Performance | No runtime CSS-in-JS; Tailwind compiles to static CSS, Radix ships behaviour only | Emotion/styled-components add runtime cost per render |
| Bundle | Per-primitive packages, tree-shakeable (`@radix-ui/react-popover` only) | Often all-or-nothing theming runtime |
| Styling conflicts | Already Tailwind; primitives are unstyled | A second styling system fighting Tailwind |
| Accessibility | Radix implements WAI-ARIA, focus traps and keyboard handling — the part that is genuinely hard | Varies; usually good |
| Upgrades | We own the wrapper source, so a library release cannot restyle the app | Major versions can force redesigns |
| Server components | Radix primitives are small client islands inside server-rendered pages | Some libraries need heavy client providers |

`cn()` in `src/lib/cn.ts` (clsx + tailwind-merge) resolves class conflicts so a
component's defaults can be overridden by callers predictably.

### Typography

Three variable typefaces, each with one job, self-hosted by `next/font` (no
external request, no layout shift) and exposed as CSS variables:

| Font | Tailwind | Used for |
| --- | --- | --- |
| **Geist** | `font-sans` | All interface text. Tall x-height, reads well at 12–14px, which is most of this app. |
| **Fraunces** | `font-display` | Page titles (`h1`) and the wordmark only. Carries the brand without costing legibility in dense tables, because it never appears there. |
| **Geist Mono** | `font-mono` | Figures and identifiers: money, dates, odometer readings, stock and invoice references. |

Mono is applied through the `.tabular` and `.ref` classes, **not** to every
table cell. Targeting `td` also caught car names, status badges and links, which
then read as code. Cells opt in; `Money`, `DateText` and `Ref` do so already, and
right-aligned money columns carry `tabular` explicitly.

Rupee, digits and separators are all present in Geist Mono, so money columns
align with no glyph falling back to another face — verified with
`CSS.getPlatformFontsForNode`. The only fallback anywhere is the `→` arrow in
prose, which Geist lacks; it renders in the system sans and is visually
indistinguishable at body size.

### The shared library

```
src/components/ui/
  index.ts           barrel — screens import from "@/components/ui" only
  button.tsx         Button (variants, sizes, asChild, loading)
  confirm-dialog.tsx ConfirmDialog        [radix alert-dialog]
  toast.tsx          Toaster, toast       [sonner]
  field.tsx          Field (label + help + error wiring)
  field-help.tsx     FieldHelp            [radix popover]
  tabs.tsx           Tabs, TabPanel       [radix tabs]
  badge.tsx          StatusBadge, Badge
  money.tsx          Money, DateText
  stat-card.tsx      StatCard
  page-header.tsx    PageHeader
  states.tsx         EmptyState, ErrorState, Loading, Skeleton
```

Screens import from the barrel, never from a file directly, so a component can
be split or moved without a repo-wide rename. Styling lives in the `.btn-*`,
`.input`, `.card` and `.badge` classes in `globals.css`, which means existing
markup that uses those classes keeps working and can migrate to the components
gradually.

Adding a primitive: install that one `@radix-ui/react-*` package, write a
wrapper here, export it from the barrel — not adopting a design system wholesale.

### Dense tables on a phone

A seven-column table does not fit 390px. Three rules make that workable, and
they apply to every table through `globals.css` rather than page by page:

- **Badges never wrap** (`whitespace-nowrap`). A `rounded-full` box that wraps to
  three lines draws an ellipse, not a pill — which is what "Pass with findings"
  did on the inspections list.
- **Body cells do not wrap** either. Previously `thead th` was `nowrap` while
  `td` was not, so headers stayed on one line while every row collapsed into a
  three- or four-line block 85–145px tall. Rows are now one line and the table
  scrolls sideways, which is what the scroll container is for. Columns of real
  prose opt out with `.cell-wrap`, which gives them a bounded width instead.
- **The first column is sticky below `sm`**, so a row keeps its identity (stock
  number, reference) while the figures scroll past, and a CSS-only shadow shows
  which edge has more content. The shadow uses `background-attachment: local`,
  so it appears only when the content actually overflows and disappears at each
  end — no scroll listener, and it never dims the content.

Measured before and after at 390px: 3 wrapped badges → 0, and cell heights from
85–145px down to 61px (the remaining 61px cells are deliberate two-line stacks
of reference above name).

If the showroom later wants full card layouts on mobile instead of a scrolling
table, that is a per-page change to the list views; the table conventions above
are what keeps them usable in the meantime.

### Route boundaries

`src/app/(app)/` defines `loading.tsx`, `error.tsx` and `not-found.tsx`.

Every page in the app is dynamic and reads from Sheets, so a navigation takes a
moment. Without `loading.tsx` the browser shows the *previous* page until the
server responds, which reads as a broken link. The skeleton makes the wait
legible.

That has one deliberate cost. `loading.tsx` turns the route into a streamed
response, so the HTTP headers are already sent by the time a page calls
`notFound()` — a missing record therefore renders the correct "not found" page
with a **200** rather than a 404. Removing `loading.tsx` restores the 404 and
was measured doing so. For an authenticated internal tool with no SEO surface,
a skeleton on every navigation is worth more than the status code on a stale
link; if that ever changes, delete `loading.tsx` and the 404 comes back.

`error.tsx` exists because Sheets reads fail transiently on quota or network,
and a retry usually succeeds — so `reset` is its primary action. It shows a
generic message and logs the real one: error text can carry spreadsheet ids and
internal paths.

### Where the primitives earn their place

| Component | Replaces | Why it matters |
| --- | --- | --- |
| `ConfirmDialog` | `window.confirm()` | Native confirm cannot be styled, blocks the thread, is browser-suppressible, and cannot show *which* record is affected. The dialog echoes the reason being recorded, traps focus and has no click-outside escape. |
| `toast` | nothing — there was no success feedback at all | Saves previously redirected in silence. Errors deliberately stay inline, where they can be acted on. |
| `Button` | 65 scattered `btn-*` classes | Carries `loading`, which disables the control mid-submit — the guard against double-posted payments. `asChild` keeps navigation as real anchors. |
| `Tabs` | a hand-rolled tab strip | Radix supplies roving arrow-key focus and `aria-controls` wiring the custom one lacked. |

### Field help

Every form field carries an information control beside its label explaining what
the field is, with an example and any gotcha. The content lives in one place,
`src/lib/field-help.ts`, keyed by the field's visible label, and `Field` looks it
up automatically — so no form has to remember to wire it, and a concept cannot
end up documented two different ways in two forms.

The control is built on Radix **Popover**, not HoverCard, on purpose: HoverCard
responds only to hover and focus, which would leave the help unreachable on a
phone. Popover gives tap and keyboard for free; hover-to-open is layered on top
and enabled only where `(hover: hover) and (pointer: fine)` matches. A
hover-opened card deliberately does not take focus, so it cannot interrupt
typing; a click- or keyboard-opened one does, so Escape and screen readers
behave normally.

## Storage model

Each of the 32 tabs has an explicit ordered column schema in
`src/lib/store/tables.ts`, validated on first access. Every row starts with the
same eight audit columns (`id`, `createdAt`, `updatedAt`, `version`,
`operationId`, `createdBy`, `updatedBy`, `archived`).

- Identity is a **UUID**. Row numbers are never identifiers — a manual sort would
  otherwise repoint every reference.
- `version` increments on every write. A write carrying a stale version is
  rejected with a 409 rather than silently overwriting someone else's edit.
- `operationId` ties a write to the operation that produced it, so a retry can be
  recognised instead of double-posting.
- Deletion is archival (`archived`). Financial records are never deleted: they are
  voided or reversed, leaving the original row in place.

## Critical writes and the gateway

**Read → check → write is not atomic in Google Sheets.** Two users reserving the
same car can both read "available" and both write.

Writes that must not interleave — reservations, sales, payments, delivery — are
expressed as a declarative `CriticalAction[]` plan rather than as imperative
calls:

| Action | Purpose |
| --- | --- |
| `assert` | Fail if a matching row exists (`notExists`) or is missing (`exists`) |
| `assert-field` | Check one field on one row (`equals`, `notEquals`, `notGreaterThan`) |
| `assert-sum` | Total a column across matching rows and refuse if adding would exceed a ceiling |
| `create` | Insert, optionally naming the new id via `as` |
| `update` | Update with an optimistic version check |

`assert-sum` exists because guards like "no overpayment" depend on a sum of other
rows. Checked before the lock, two simultaneous payments each read the same stale
total and both pass. Evaluated inside the critical section, they cannot.

A plan is executed by exactly one of two engines, and they must agree:

| Mode | Engine | Serialization |
| --- | --- | --- |
| Google Sheets | `apps-script/Gateway.gs` | Apps Script `LockService` script lock, shared by all app instances |
| Demo / tests | `src/lib/store/execute-actions.ts` | In-process mutex |

Values of the form `"$ref:<name>"` resolve to the id created earlier in the same
plan, so linked records are written atomically from the lock holder's view. Both
engines return `refIds`, mapping each `as` name to its id — services use those
names rather than array positions, which shift whenever a plan gains an action.

**The in-process mutex is not a distributed lock.** It is correct for the demo
store and for tests. In production the Apps Script lock is the guarantee.

### Keeping the two engines honest

`tests/gateway-parity.test.ts` loads the real `apps-script/Gateway.gs` source
into Node with mocked Apps Script globals (`SpreadsheetApp`, `LockService`,
`PropertiesService`, `Utilities`) and runs the *same* action plans through both
engines, asserting identical results, identical rejection messages and statuses,
and identical `refIds`.

This matters: the gateway is the only code path production uses for critical
writes, and it cannot be exercised by ordinary tests. Without parity testing the
app would be verified entirely against an engine it never runs.

### Idempotency and recovery

Gateway requests are signed (HMAC-SHA-256 over the payload) and carry an
`operationId`. The gateway records completed operations in Script Properties and
returns the original result for a replay, inside the lock, so a client retry
after a network timeout cannot apply the writes twice. The app additionally
records each operation in the `Operations` tab with status and attempt count.

Where several writes genuinely cannot be atomic, the app relies on operation
records, idempotency and reconciliation (`pnpm sheets:audit`) rather than
pretending a transaction happened.

## What Google Sheets cannot do

Stated plainly, because the design is shaped by these limits:

| Limitation | Consequence | What the app does |
| --- | --- | --- |
| No transactions | Multi-row writes can half-apply | Critical plans run under one shared lock; `Operations` records allow reconciliation |
| No indexes | Every query is a full-tab read | Batched reads, a short TTL cache, invalidation after writes |
| API quotas | Bursts get 429s | Bounded retries with exponential backoff and jitter |
| Anyone with access can edit | Manual edits skip validation and audit | Documented, plus a read-only reconciliation report |
| No referential integrity | Broken references are possible | `reconcile()` reports them |

Sheets does **not** provide indexed database queries or unlimited scale. Design
targets are ~800 vehicles and ~10,000 rows per tab; these are targets, not
measured benchmarks.

## Caching

Reads go through a short (15 s) TTL cache, invalidated after every write. This
keeps a page render to a small number of API calls rather than one per lookup. It
means a change made directly in the spreadsheet can take up to 15 seconds to
appear in the app.

## Permissions

Roles are owner, sales, operations and accounts, defined in
`src/lib/permissions.ts` as explicit permission lists.

- Authorization is enforced on the server for every read, write, export and file
  request. Most API routes use the `withPermission(...)` wrapper; the three that
  stream or upload (`/api/media/[fileId]`, `/api/media/upload`,
  `/api/reports/export`) check the session and permission inline because they do
  not return JSON.
- File retrieval is doubly gated: a file is served only when the app holds a
  metadata row for it (so a session cannot be used to guess ids elsewhere in the
  service account's Drive), and documents marked `sensitive` additionally require
  `document.sensitive`, which operations staff do not have.
- Confidential figures (purchase price, minimum price, investment, margin) are
  gated by `purchase.view` and `profit.view`.
- Customer-facing documents are built from **allowlists**
  (`customerVehicleProjection`, `customerSaleDocument`). Confidential fields are
  never fetched into those pages, so they cannot leak through markup or the RSC
  payload — a property asserted by tests.

## Lifecycle dimensions

Business state is deliberately **not** one status field:

1. Acquisition pipeline — `AcquisitionCases.status`
2. Inventory/sale — `Vehicles.lifecycleState`
3. Publication (future website) — `Vehicles.publicationState`
4. Per-record status — work orders, service requests, reservations, sales

Transitions have prerequisites: *Ready for sale* requires a receiving or
pre-delivery inspection and no open showroom work orders; *Delivered* requires a
completed checklist or a recorded, owner-approved exception. Overrides are
recorded with a reason in `StatusHistory`.

A vehicle keeps one identity for life. Re-acquiring a previously sold car creates
a **new** acquisition case rather than overwriting the earlier purchase or sale.
