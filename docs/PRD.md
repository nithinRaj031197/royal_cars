# Product requirements — Royal Cars admin

## The problem

Royal Cars buys used cars from private sellers, prepares them, and sells them
on. Today that history lives in spreadsheets, notebooks and people's memory. The
owner cannot answer, for one car: *what did we pay, what did we spend, what did
we sell it for, and what do we still owe or are owed?*

## Who uses it

| Role | Needs |
| --- | --- |
| **Owner** | The money trail per car, totals, and control over staff |
| **Sales** | Leads, test drives, reservations, sales — without seeing cost or margin |
| **Operations** | Inspections, work orders, vendors, delivery |
| **Accounts** | Payments in both directions, expenses, financial reports |

Only **owner** can sign in today; the other roles exist in data and permissions
but their screens are not finished.

## Scope — this phase

Admin portal only. In:

1. Seller enquiries and the acquisition pipeline
2. Inspections (pre-purchase, receiving, post-repair, pre-delivery, after-sale)
3. Owned inventory with lifecycle states
4. Repairs, accessories, vendors and expenses
5. Leads, customers, follow-ups, test drives
6. Reservations, sales, payments, delivery
7. After-sale commitments, service requests and customer-billable work
8. Per-car money trail, reports, CSV import/export
9. Staff, permissions, settings, activity history

Out of scope: the public website. The fields and an allowlisted projection exist
so it can be built later, but no public pages are served.

## What success looks like

The owner opens any car and sees, in one page: the seller, what was agreed, what
has been paid, every repair and cost, what it sold for, what the customer still
owes, after-sale work, and the resulting contribution — with no figure counted
twice. That page is `/ledger/[id]`.

## Constraints

- **Google Sheets is the store.** No other database. See
  [ARCHITECTURE.md](ARCHITECTURE.md) for what that costs and how it is handled.
- **Mobile first.** Staff work on the showroom floor, on phones.
- **INR, Asia/Kolkata, kilometres**, Indian number formatting.
- **Money is integer paise.** Never floating-point rupees.

## Deliberate non-goals

- No self sign-up. Accounts are created by an owner.
- No automatic warranty. Nothing is promised to a customer unless recorded.
- No vehicle-level figure presented as business profit; overhead is excluded.
