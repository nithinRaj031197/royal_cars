# Admin guide

For showroom staff. It assumes no technical background — it describes what to
click and, where the software refuses to do something, why.

The portal works on a phone. On a small screen the menu is behind the **☰**
button at the top left; tables become cards.

---

## Signing in

Use the **Sign in with Google** button with your work account. If you see
"access denied", your address has not been added to the staff list yet — ask the
owner to add you in Settings → Staff. There is no password to set or forget.

What you can see depends on your role:

| Role | Can do | Cannot see |
| --- | --- | --- |
| Owner/Admin | Everything, including staff management | — |
| Sales | Leads, customers, test drives, reservations, sales | Purchase price, minimum price, profit |
| Operations | Inspections, work orders, inventory, delivery | Profit, payments, identity documents |
| Accounts | Payments, expenses, financial reports | Cannot change acquisitions |

Where a figure is hidden from your role you will see **—** rather than a blank
space, so you know something exists but is not yours to see.

---

## The daily loop

### 1. A seller offers a car — Acquisitions

**Acquisitions → + New seller enquiry.** Record the seller, the car and what they
are asking. This creates an enquiry; it does **not** put the car in your stock.

The status moves: New enquiry → Inspection scheduled → Evaluated → Negotiating →
Approved → Acquired. You can also mark it **Rejected** or **Cancelled** with a
reason.

Rejected enquiries stay searchable forever — useful when a seller comes back
three months later — but never appear in inventory.

> Keep seller claims and inspection findings apart. What the seller tells you
> goes in the enquiry; what your inspector verifies goes in the inspection. That
> is why accident and flood history offer **Unknown / Reported / Verified** and
> not just yes/no: "we don't know" is a real answer and must not be recorded as
> "no".

### 2. Inspect it

**Inspections → + New inspection**, type *Pre-purchase*. Work through the areas
(exterior, interior, engine, transmission, tyres, battery, AC, electrical,
suspension, brakes, lights, underbody, leaks, test drive, documents), rating each
Excellent / Good / Average / Needs repair / Critical / Not inspected, and add an
estimated repair cost.

Tick **create work order** on a finding to queue the repair. The estimate travels
to the work order; it is not counted as a cost until the work is actually done.

### 3. Buy it

On the acquisition case, **Mark acquired** with the agreed price and purchase
date. The car now gets a stock number (`STK-00001`) and enters inventory.

Record what you pay the seller under **Purchase payments** — one record per
payment, with method and reference. The outstanding seller balance is calculated
from that history, so it is always right.

> A payment to the seller settles what you owe for the car. It is **not** a
> vehicle expense and is never counted twice.

You cannot pay the seller more than the agreed purchase price. If you genuinely
need to, correct the agreed price first — that keeps a trail.

### 4. Prepare it for sale

Raise **work orders** for repairs, and record **accessories** and **other
expenses**.

Work orders go Draft → Approved → In progress → Completed (or Cancelled). Costs
count towards the car's investment **only** when the order is Completed and the
showroom is the payer. Estimates never count.

The rules that stop double counting:

- An accessory linked to a work order is billed inside that invoice — record the
  link and it will not be added again.
- Expenses in the **Repair** or **Accessories** categories are excluded from
  "other costs", because they are already counted through work orders and the
  accessories list.
- Work paid by the customer or the seller never becomes a showroom cost.
- A cancelled work order costs nothing.

### 5. Price it

On the vehicle's **Pricing** tab, set the asking price. Every change needs a
reason and is kept forever — nothing is overwritten. The minimum acceptable price
is visible only to roles allowed to see margins.

### 6. Make it available

Set the vehicle to **Ready for sale**. The system will refuse if:

- there is no receiving or pre-delivery inspection, or
- showroom work orders are still open.

Finish or cancel the outstanding work, then try again.

### 7. Buyers — Leads & Customers

Record the customer, what they are interested in, their budget and the
salesperson. Book **test drives** and record the outcome. Set **follow-up dates**
— overdue ones appear on the dashboard, which is the point of setting them.

One customer can have many enquiries and many purchases over the years.

### 8. Reserve, sell, collect

**Reservation** — vehicle, customer, agreed price, booking amount, expiry.
Only one active reservation per car: if someone else has already booked it you
will be told, even if you both clicked at the same moment.

**Sale** — convert the reservation (the booking amount carries into the sale
balance automatically; it is never collected or counted twice) or sell directly.

**Payments** — record each one with method, reference and date. The balance is
always calculated from the payments, never typed in.

You cannot record more than the balance due. To correct a mistake, **void** the
payment with a reason and record the right one: the original stays visible so the
history still makes sense.

**Cancelling** a reservation or sale keeps everything that happened, records the
reason and refund, and releases the car so it can be sold to somebody else.

### 9. Hand it over — Delivery

Work through the delivery checklist: final inspection, promised repairs,
cleaning, keys and accessories, documents, payment review, and the customer's
acknowledgement. Record the delivery date and odometer.

Mandatory items must be ticked. If money is still outstanding, delivery needs an
**owner-approved exception with a written reason**, which is stored against the
delivery — this is the audit trail for letting a car leave unpaid.

### 10. After the sale

Record what you actually promised under **Service commitments** — free services,
a promised repair, coverage with its exclusions, dates and any odometer limit.
Nothing is promised automatically: if you did not agree a warranty, none is
recorded.

When the customer reports a problem, raise a **service request**: complaint, date,
odometer, priority. Decide **coverage** — covered by a commitment, goodwill, or
customer-billable — and record why. Then log the work, parts and labour.

Customer-billable work has its **own** charges and payments, kept entirely
separate from the car's sale balance. A service bill is never mixed into what
they paid for the car.

After-sale work never puts a delivered car back into available stock.

---

## Following one car's money

**Money → Car money trail** shows a single vehicle end to end:

1. **Seller → Showroom** — the agreed price, every payment you made, what is still owed.
2. **In the showroom** — every work order, accessory and expense. Amounts that are
   deliberately *not* counted appear greyed out with the reason, so you can see
   that an accessory billed inside a work-order invoice has not been added twice.
3. **Showroom → Customer** — the sale price, every payment received, the balance.
4. **After the sale** — service you funded, and anything the customer was billed.

The panel on the right totals it: purchase + repairs + accessories + other costs =
total invested; sale price − invested = gross profit; less showroom-funded service
= contribution.

## Reading the money

| Term | Meaning |
| --- | --- |
| Pre-sale investment | Purchase price + completed showroom repairs + accessories + other showroom costs |
| Gross vehicle profit | Final net sale price − pre-sale investment |
| Customer payments | Cash received. **Not** the sale price and **not** profit |
| Seller balance | What you still owe the seller |
| Customer balance | What the customer still owes you |

**Gross vehicle profit is not the business's profit.** It does not include rent,
salaries, electricity or advertising that is not tied to a specific car. It tells
you how a particular vehicle did, nothing more.

Figures shown for a sold car are a snapshot taken at the time of sale. Later
costs (an after-sale repair you paid for) are shown separately, so the original
deal and what happened afterwards stay distinguishable.

---

## Customer copies

**Customer View** produces what you hand to a buyer:

- **Sale copy** — their details, the car, every payment, the balance, delivery
  details, what you committed to, and any after-sale work with what *they* were
  charged.
- **Vehicle detail sheet** — specification, approved photos and the asking price.

These never contain what you paid for the car, your margin, the minimum price or
the seller's identity. Use **Print** for a paper or PDF copy.

---

## Reports and exports

Reports covers inventory, purchases, work costs, expenses, sales, payments,
profitability, stock ageing and after-sale support. Date ranges are always
labelled, and use Indian dates and rupees.

Exports are CSV and open safely in Excel or Sheets. Internal reports and customer
copies are separate templates — the customer template never includes confidential
costs or seller information.

---

## Importing from an existing spreadsheet

**Settings → Import.** Download the template for what you are importing, fill it
in, and upload.

You will get a preview with row-by-row errors before anything is written. Fix the
flagged rows and re-upload — importing the same file twice updates the matching
records instead of creating duplicates.

Every row must have the same number of columns as the header. A row with a
missing comma shifts every later value into the wrong column, so the import
rejects that row rather than saving nonsense.

Phone numbers and reference numbers keep their leading zeros.

---

## When something goes wrong

**"This record was changed by someone else."**
Somebody edited it while you had the form open. Reload and redo your change —
this is deliberate, so your edit cannot silently erase theirs.

**"This vehicle already has an active reservation."**
Someone booked it first. Check the reservations list; cancel the existing booking
if it is genuinely dead.

**"Payment exceeds the balance due."**
The amount is more than what is outstanding. Check the payment history — the
payment may already have been recorded by someone else.

**"Gateway busy, try again."**
Another critical write was in progress. Wait a moment and retry; the system
prefers making you wait over risking a double-posted payment.

**Something looks wrong in the data.**
Ask whoever administers the system to run the reconciliation report. It finds
duplicate ids, references pointing at deleted records, invalid amounts and
operations that did not finish.

---

## Editing the spreadsheet directly

Please don't.

Edits made in Google Sheets bypass every validation rule and leave no audit
record — the app cannot tell what changed or who changed it. They can also break
links between records in ways that are tedious to unpick.

If it is truly unavoidable, tell your administrator so they can run the
reconciliation report afterwards.
