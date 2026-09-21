# Design

## Brand

Royal Cars: **red on black**. Red is the accent and the primary action; black is
the sidebar and login panel; everything else is near-white with slate text.

Red carries meaning and is therefore rationed. It means **primary action**,
**error**, or **money owed** — nothing else. Two corrections were needed to hold
that line:

- the focus ring was brand red, so every focused field looked like it had failed
  validation. Focus is now `slate-900`; red is reserved for `aria-invalid`.
- the field-help icon highlighted red on hover, competing with real errors. It is
  grey throughout.

## Type

| Font | Used for | Why |
| --- | --- | --- |
| **Geist** | All interface text | Tall x-height, reads well at 12–14px |
| **Fraunces** | Page titles, wordmark | Brand character where density does not matter |
| **Geist Mono** | Money, dates, references | Digits share a width, so columns align |

Mono is opt-in via `.tabular` / `.ref`, never applied to whole table cells —
doing that made car names and badges read as code.

## Layout

- **Mobile first.** Base styles are the phone; `sm:` and `lg:` add to them.
- Sidebar is a fixed rail at `lg`, an animated drawer below it.
- Content is capped at `max-w-6xl` and gutters are 16px on a phone.
- Verified: every page has **zero horizontal overflow** at 390 / 768 / 1440px,
  measured with `scrollWidth` vs `clientWidth`.

## Navigation

Grouped by the car's journey, not by software module, because that is how the
showroom thinks:

**Buying · Preparing · Selling · After sale · Money**

Group headers are one short word with a rule to the panel edge and no icon, so
they cannot be mistaken for a row. An earlier version used two-line labels with
arrows (`Seller → Showroom / Buying the car in`) and readers could not tell
whether they were links.

## Tables on a phone

A seven-column table does not fit 390px, so it scrolls, with:

- **badges that never wrap** — a `rounded-full` box wrapped to three lines draws
  an ellipse, not a pill;
- **single-line rows** — cells are `nowrap`, with `.cell-wrap` for prose columns.
  Before this, rows were 85–145px tall;
- **a sticky first column**, so the row keeps its identity while figures scroll;
- **a CSS-only scroll shadow** that appears only when content overflows and
  disappears at each end.

## Motion

Framer Motion for the drawer spring, page fade, and tile stagger. Two rules:

1. **Content never depends on JavaScript to become visible.** An earlier page
   transition set `opacity: 0` in the server HTML, so every page was blank until
   hydration — which looked exactly like broken navigation. First render now
   ships visible; entrance animation for tiles is CSS.
2. Everything collapses to an instant change under `prefers-reduced-motion`.

## Forms

- Label, control, help and error are wired together by `Field`: `htmlFor`,
  `aria-describedby`, `aria-invalid`.
- Every field has an **ⓘ** explaining it with an example, from one dictionary
  (`src/lib/field-help.ts`) keyed by label.
- Built on Radix Popover, not HoverCard, so help is reachable by tap on a phone.
