# Business rules

The rules the code enforces. Each is testable, and most have a test.

## Money

- All amounts are **integer paise**. `₹1,234.50` is `123450`.
- **Pre-sale investment** = agreed purchase price + completed showroom-funded
  repairs + accessories not already billed inside a work order + other
  showroom-paid vehicle costs.
- **Gross vehicle profit** = final net sale price − pre-sale investment.
- **Contribution** = gross profit − showroom-funded after-sale work.
- Customer receipts are **cash flow**. They never change the sale price or profit.
- A vehicle-level figure is never presented as business net profit: general
  overhead is excluded.

## No double counting

Each posted amount has exactly one canonical source:

| Amount | Counted from | Never also from |
| --- | --- | --- |
| Repairs | Completed work order `actualPaise` | Expenses in category `Repair` |
| Accessories | Accessories without a `workOrderId` | The work order invoice that already includes them |
| Other costs | Expenses, excluding `Repair` and `Accessories` | Anywhere else |

Estimates never count. Cancelled work never counts. Customer- or seller-paid
work is recorded but is not a showroom cost.

## Purchases

- A payment to the seller settles the purchase liability; it is **not** a vehicle
  expense.
- Seller balance is derived from payment history, never typed in.
- Payments cannot exceed the agreed purchase price.

## Sales

- Only one **Active** reservation per vehicle. Cancelled and expired ones do not
  block a new booking.
- A booking amount transfers into the sale balance and is never collected twice.
- Payments cannot exceed the balance due. Corrections are void/reversal, never
  deletion.
- Delivery requires mandatory checklist items, or an owner-approved exception
  with a written reason when a balance is outstanding.

## After-sale

- Nothing is promised unless a commitment is recorded.
- Customer-billable service has its own charges and balance, entirely separate
  from the car's sale balance.
- After-sale work never returns a delivered vehicle to available stock.

## Lifecycle

State is four independent dimensions, not one field: acquisition pipeline,
inventory/sale, publication, and per-record status.

- **Ready for sale** requires a receiving or pre-delivery inspection and no open
  showroom work orders.
- **Delivered** requires a completed checklist or a recorded exception.
- Archiving preserves financial and service history.
- Re-acquiring a sold car creates a **new** acquisition case; earlier history is
  never overwritten.

## Records

- Descriptive fields are optional — the showroom is entering incomplete history.
- Two minimums: a person needs a name **or** phone; a vehicle needs a
  registration, make **or** model.
- Structural fields stay required: foreign keys, and the amount on a payment.
- Unknown numbers are stored **blank**, not `0`.
- Accident and flood history support Unknown / Reported / Verified. Missing
  information is never recorded as "None".
