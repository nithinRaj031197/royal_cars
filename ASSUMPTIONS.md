# Assumptions

Business decisions taken where the brief did not specify one. Each records what
was assumed, why, and how to change it. They are recorded here rather than buried
in code so the showroom can disagree with any of them.

## Money and counting

**Only *completed* work orders with `payer = Showroom` enter investment.**
Estimates and open jobs are commitments, not costs; an owner valuing stock today
should see what has actually been spent. Cancelled orders count nothing.
*Change:* `investmentBreakdown()` in `src/server/services/work.ts`.

**A work order's invoice total is canonical; its line items are informational.**
Adding both would double the cost. Line items exist to explain the invoice.

**An accessory linked to a work order is not counted separately.** It is inside
that invoice. Standalone accessories are counted in full.

**Expenses in the `Repair` and `Accessories` categories are excluded from "other
costs".** Those amounts arrive through work orders and the accessories list.
Recording them as expenses too is the most likely double-count in daily use, so
the software drops them rather than trusting the category was used carefully.

**Seller payments settle the purchase liability and are never an expense.**
Otherwise the purchase price would be counted twice.

**Overpayment is refused everywhere** — seller payments, customer payments and
service charges. The brief allows a deliberate credit-balance workflow; none is
implemented, so the safe behaviour is to refuse and make the user correct the
underlying figure. *Change:* the `assert-sum` guards in `sales.ts`,
`purchases.ts` and `aftersale.ts`.

**Setting the initial asking price also sets the current asking price**, but only
while the current price is unset. A car is listed at its asking price until
somebody changes it, and correcting the initial figure later should not silently
undo a real price change.

## Lifecycle

**Ready for sale requires a receiving or pre-delivery inspection, and no open
showroom work orders.** Selling a car nobody has checked since it arrived is the
mistake worth preventing. Customer- and seller-paid work does not block it.

**Cancelling a reservation returns the vehicle to *In preparation*, not *Ready
for sale*.** The Ready-for-sale gate runs again, which is the conservative choice
after a booking falls through.

**Only one *Active* reservation per vehicle.** Cancelled and expired reservations
never block a new one — an earlier bug did exactly that, and the behaviour is now
covered by tests.

**Delivery with an outstanding balance is allowed only with an owner-approved
exception and a written reason**, both stored on the delivery checklist. Showrooms
do release cars against a promise; the software records it rather than pretending
it cannot happen.

**A re-acquired vehicle gets a new acquisition case** and keeps its original
identity, so its earlier purchase and sale stay intact.

## Roles

**Four roles: owner, sales, operations, accounts**, as suggested by the brief.

- **Sales cannot see purchase price, minimum price or margin.** Common practice,
  and it protects negotiation.
- **Operations can see purchase cost but not profit** — needed to judge repair
  spend against what the car cost.
- **Accounts cannot manage acquisitions** — separation between recording money and
  agreeing deals.

*Change:* `ROLE_PERMISSIONS` in `src/lib/permissions.ts`.

**A session without a resolved role is denied everything.** Failing closed is the
right default for an unexpected state.

**Sessions last 12 hours** — about one working day, so staff sign in once a day
on a shared showroom machine.

## Data

**Identity documents are stored masked** (`idNumberMasked`, e.g.
`XXXX-XXXX-4432`). The full number is not needed to run a showroom, and storing
less of it is the safer default. Scans can be attached as documents where the law
requires them, marked sensitive.

**Customers are matched by phone number.** In an Indian showroom it is the most
reliable identifier — more so than email or spelling of a name.

**Accident and flood history default to *Unknown*, never *No*.** Absence of
information is not evidence of absence, and "no accident history" is a claim that
affects price.

**INR, Asia/Kolkata, kilometres.** Storage is ISO timestamps for events and
date-only `YYYY-MM-DD` for business dates; display is Indian formatting.
*Change:* `src/lib/config/constants.ts` and Settings.

## Incomplete records

**Forms accept partial data.** The showroom is entering history it already holds
on paper, and that history has gaps — a car bought years ago with no VIN
recorded, a walk-in seller who never gave a phone number. Refusing the save
loses the information entirely, which is worse than storing a partial record.
Descriptive fields therefore accept blanks, and a value is validated only when
one is actually supplied.

**Two minimums are still enforced**, so a saved record stays usable:

- a seller or customer needs **a name or a phone number**;
- a vehicle needs **a registration number, a make or a model**.

**Structural fields stay required**, because they are what keep the data
coherent rather than merely descriptive: which vehicle or sale a record belongs
to, and the amount on a payment. A payment with no amount is not a payment, and
the overpayment guards depend on it.

**Unknown numbers are stored blank, not zero.** An odometer of `0` reads as a
fact; an empty cell reads as "not recorded", which is the truth.

**Blank phone numbers never merge people.** Customers are matched on phone, so
matching on an empty string would fold every customer recorded without a number
into one record. Matching is skipped when there is no phone.
*Change:* `upsertCustomer` in `src/server/services/crm.ts`.

## Operations

**The application spreadsheet is dedicated to the app**, separate from whatever
the showroom used before, which stays untouched as a migration source.

**Manual spreadsheet edits are possible and cannot be prevented.** The spreadsheet
owner can always edit the file; the app can only refuse to pretend otherwise. So
the app validates on read, and ships a read-only reconciliation report.

**A CSV row whose column count differs from the header is rejected.** A missing
comma shifts every later value one column left, which imports silently corrupted
data. Rejecting the row is noisier and safer.

**A bad row fails that row, not the batch.** One typo should not discard a
500-row import; errors are reported per row with line numbers.

**Uploads: 15 MB per file**, JPEG/PNG/WebP/HEIC for photos and PDF/DOC(X)/images
for documents. Originals are kept legible rather than aggressively compressed,
because inspection evidence and invoices need to be readable later.

**Drive files are never made public.** Every file is proxied through the app after
a session check.

**The gateway's idempotency markers are pruned after 7 days.** Apps Script
property storage is limited, and a retry arriving a week later is not a retry.

## Scope

**No public website**, per the brief. The fields a public site needs (slug, public
title and description, features, SEO fields, publication state) exist on the
vehicle, and an explicit allowlisted projection is implemented and tested, but no
public pages are served.

**"Customer view" means printable customer-facing documents**, not a public site.
Those pages still require staff sign-in; what makes them customer-safe is the
allowlist they are built from, so confidential figures are never fetched into the
page at all.

**Photo optimisation happens at display time, not on upload.** Originals are
preserved. There is no image-processing pipeline in this phase.
