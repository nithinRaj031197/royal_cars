# Test plan

## How this suite is organised

| File | Covers |
| --- | --- |
| `tests/workflows.test.ts` | End-to-end business scenarios against the store |
| `tests/gateway-parity.test.ts` | The Apps Script gateway vs the in-app engine |
| `tests/password.test.ts` | Password hashing and policy |
| `tests/api-errors.test.ts` | Error mapping and IST business dates |
| `tests/concurrency-media-projection.test.ts` | Races, uploads, confidential projections |
| `tests/form-contracts.test.ts` | Every form's payload shape, including blank fields |

Run with `pnpm test`. They use the in-memory store, so they are fast and need no
Google credentials.

## Scenarios covered

1. Enquiry → inspection → rejected acquisition (stays searchable, not in stock)
2. Enquiry → acquisition → seller payments → balance from history
3. Inspection → work orders → accessories → expenses → ready-for-sale gate
4. Price change with preserved, append-only history
5. Reservation → sale → partial payments → delivery
6. Cancellation and refund without lost history
7. After-sale complaint → coverage decision → repair → closure
8. Customer-billable service with a separate balance
9. No duplicated invoice or accessory amounts
10. Retried payment does not double-post
11. Concurrent reservations — exactly one wins
12. Stale-edit rejection
13. CSV validation, ragged rows, repeat imports
14. Upload validation and failed-upload recovery
15. Role enforcement and confidential projections
16. Interrupted operations recorded for reconciliation
17. Partial records from migrated history

## Form payload contracts

`tests/form-contracts.test.ts` exercises each schema the way a browser does: a
flat object of **strings**, with `""` for anything the user left alone — never
`undefined`. For every form it asserts four things:

1. the minimal payload is accepted;
2. a fully filled payload is accepted;
3. **a blank form parses** — every optional field tolerates `""`;
4. **`""` and an omitted key mean the same thing**;
5. the structurally required fields still are (blanking them must fail).

Property 4 is the valuable one. Zod's `.default()` only fires for `undefined`,
so `z.enum([...]).default("Walk-in")` *rejects* a blank select, and
`z.string().default("INR")` silently stores `""`. Writing these tests found both:
24 of the first 95 assertions failed, across enums, optional money, counts,
booleans and defaulted strings — including a settings save that would have wiped
the currency and timezone.

The blank-form simulation blanks scalars only; a checklist array is built by the
UI and never posted as `""`.

Round-trip tests then confirm a blank-heavy payload reaches the store correctly:
unknown numbers stored blank rather than `0`, defaults applied, and the
no-double-counting rules still holding.

## What is deliberately *not* unit-tested

- **The live Google integration.** The suite proves business logic. Only running
  `sheets:check` → `setup` → `validate` → `seed` → `audit` against a real
  spreadsheet proves the integration, and that is a manual step.
- **The deployed Apps Script gateway.** Parity tests execute the real
  `Gateway.gs` source against a mocked Sheets API, which proves the *semantics*
  match. It does not prove your deployment works.

## Manual checks that caught what tests could not

These are worth repeating after significant UI change:

| Check | How |
| --- | --- |
| Page renders without JavaScript | Disable JS; content must still be visible |
| No horizontal overflow | `scrollWidth` vs `clientWidth` at 390 / 768 / 1440 |
| Console clean | Load every page, watch for errors and warnings |
| Navigation lands on **visible** content | Assert computed opacity, not just the URL |
| Focus is visible and neutral | Keyboard-tab through a form |
| Sign-out actually signs out | Click it; confirm session is empty |

The fourth one matters: an early test asserted the URL and heading text and
passed while every page was in fact blank, because the content was rendered at
`opacity: 0`.

## Verification gates

Before any commit:

```
pnpm typecheck   # tsc --noEmit, zero errors
pnpm lint        # eslint, zero problems
pnpm test        # all green
pnpm build       # production build succeeds
```
