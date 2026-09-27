# Field requirements

Every form in the app, generated from the Zod schemas that are the single
source of truth (`src/lib/form-schemas.ts`) — the same objects both the
client forms and the API routes validate against, so this list cannot drift
from what the code actually enforces.

A field counts as **mandatory** if submitting the form with that field
missing is rejected. Everything else is optional: it may be left blank, and
the showroom can fill it in later. This reflects the "don't require what you
don't know yet" decision — most fields across the app are optional by design,
because staff are often entering a paper record that is itself incomplete.

Regenerate this list at any time with:

```bash
npx tsx scripts/field-audit.ts
```

## Summary

**209 fields across 23 forms. 63 mandatory, 146 optional.**

| Form | Mandatory fields | Optional field count |
|---|---|---|
| Seller enquiry / acquisition — `/acquisitions/new` | *(see note below)* | 25 |
| Inspection — `/inspections/new` | vehicleId, type, date, overallResult | 8 |
| Inspection checklist row (nested) | area, condition | 4 |
| Work order — `/work/new` | vehicleId, stage | 13 |
| Work order completion | completedOn | 7 |
| Accessory — vehicle detail | vehicleId, unitCost | 8 |
| Expense — `/vendors` | vehicleId, category, date, amount | 6 |
| Customer — `/leads/new` (New customer) | *(none)* | 8 |
| Lead — `/leads/new` | customerId, source | 5 |
| Follow-up — lead detail | customerId, dueDate | 4 |
| Test drive — lead detail | customerId, vehicleId, scheduledAt | 3 |
| Reservation — `/sales/new?type=reservation` | vehicleId, agreedPrice, bookingAmount, bookingDate | 5 |
| Sale — `/sales/new` | vehicleId, finalNetPrice, saleDate | 5 |
| Sale payment — sale detail | saleId, date, amount, method | 4 |
| Price change — vehicle detail | vehicleId, kind, amount, reason, date | 0 |
| Purchase payment — acquisition detail | acquisitionCaseId, date, amount, method | 3 |
| Delivery — sale detail | saleId, deliveryDate, items | 4 |
| After-sale commitment — sale detail | saleId, kind, coverage, startDate | 5 |
| Service request — `/aftersale/new` | saleId, complaint, reportedDate | 4 |
| Service job — service request detail | serviceRequestId, date, workDone | 3 |
| Service charge — service request detail | serviceRequestId, date, amount, method | 3 |
| Settings — `/settings` | showroomName | 14 |
| Staff account — `/settings` (staff) | email, name, role | 2 |

**Note on the acquisition form:** its schema requires nothing directly — every
field, including seller name and vehicle registration, can individually be
blank. Instead it carries one combined rule (a `superRefine`, not a per-field
check):

- At least **one of** seller name **or** seller phone must be filled, so the
  record is still findable.
- At least **one of** registration number, make, **or** model must be filled,
  so the record still refers to a car.

This is why the form can be saved with almost nothing filled in, yet still
cannot be saved completely empty.

## Detail: every mandatory field, form by form

### Seller enquiry / acquisition — `/acquisitions/new`
- Combined rule: seller name OR seller phone (see note above)
- Combined rule: registration number OR make OR model (see note above)
- Everything else — alt phone, email, address, lead source, variant, year,
  fuel, transmission, body type, colour, odometer, ownership count, VIN,
  engine number, registration location, expected price, inspection
  appointment, follow-up date, negotiation notes — is optional.

### Inspection — `/inspections/new`
- `vehicleId` — must pick a vehicle
- `type` — Pre-purchase / Receiving / Post-repair / Pre-delivery / After-sale
- `date`
- `overallResult` — Pass / Pass with findings / Fail / Not completed
- Each checklist row, if added, requires `area` and `condition`; the finding
  text, estimated cost, and "create work order" flag are optional.

### Work order — `/work/new`
- `vehicleId`
- `stage` — Pre-purchase / Inventory preparation / Pre-delivery / After-sale
- Everything else (issue, required work, category, vendor, assignee,
  estimate, dates, odometer, payer) is optional — `category` defaults to
  "General" if left blank.
- **Completing** a work order requires `completedOn`; the cost breakdown
  (parts, labour, other, tax, discount) and invoice number are optional.

### Accessory (vehicle detail)
- `vehicleId`
- `unitCost` — must be a valid amount (this field cannot be blank; it is not
  wrapped in the optional-money helper)
- Quantity defaults to 1 if blank. Item name, vendor, install date, and
  "required" flag are optional.

### Expense — `/vendors`
- `vehicleId`, `category`, `date`, `amount`
- Payer defaults to "Showroom". Sale/service linkage, vendor, reference, and
  notes are optional.

### Customer — `/leads/new` (New customer)
- **Nothing is mandatory.** A customer record can be created fully blank —
  this is intentional so a walk-in with no details yet can still be logged.

### Lead — `/leads/new`
- `customerId` — must choose or create a customer first
- `source` — one of the lead source enum values
- Vehicle of interest, budget, status, assignee, and notes are optional.

### Follow-up (lead detail)
- `customerId`, `dueDate`
- Lead link, vehicle link, note text, and status are optional (status
  defaults to "Open").

### Test drive (lead detail)
- `customerId`, `vehicleId`, `scheduledAt`
- Lead link, staff assigned, and notes are optional. This is the strictest
  small form in the app — a test drive without a vehicle, a customer, and a
  time makes no sense to record at all.

### Reservation — `/sales/new?type=reservation`
- `vehicleId`, `agreedPrice`, `bookingAmount`, `bookingDate`
- Customer name/phone, expiry date, terms, and notes are optional — though in
  practice a reservation without a customer name is not very useful, and the
  Cypress suite confirms the *server* accepts it (there is no combined rule
  here the way there is on acquisitions).

### Sale — `/sales/new`
- `vehicleId`, `finalNetPrice`, `saleDate`
- Customer name/phone, reservation link, payment terms, and notes are
  optional.

### Sale payment (sale detail)
- `saleId`, `date`, `amount`, `method`
- Kind defaults to "Part payment". Reference, notes, and idempotency key are
  optional (the idempotency key, when supplied by the client, prevents a
  double-submitted click from posting the same payment twice).

### Price change (vehicle detail)
- `vehicleId`, `kind`, `amount`, `reason`, `date` — **every field on this form
  is mandatory.** A price change with no stated reason is exactly the kind of
  silent edit the audit trail exists to prevent.

### Purchase payment (acquisition detail)
- `acquisitionCaseId`, `date`, `amount`, `method`
- Reference, notes, and a linked document file are optional.

### Delivery (sale detail)
- `saleId`, `deliveryDate`, `items` (the checklist array itself must be
  present, though individual non-mandatory checklist items may be left
  unticked — see the note below)
- Odometer, customer instructions, and the outstanding-balance exception are
  optional.
- **Not visible to the schema, but enforced in the UI:** items marked
  mandatory in the checklist (`CHECKLIST_ITEMS`) must be ticked before the
  "Complete delivery" button will succeed; the schema itself does not check
  this, so it is effectively an application-layer requirement.

### After-sale commitment (sale detail)
- `saleId`, `kind`, `coverage`, `startDate`
- Exclusions, end date, odometer limit, eligible services count, and
  approval notes are optional.

### Service request — `/aftersale/new`
- `saleId`, `complaint`, `reportedDate`
- Odometer, priority (defaults to "Normal"), appointment time, and notes are
  optional.

### Service job (service request detail)
- `serviceRequestId`, `date`, `workDone`
- Odometer, diagnosis, parts cost, labour cost, vendor, and staff are
  optional.

### Service charge (service request detail)
- `serviceRequestId`, `date`, `amount`, `method`
- Kind defaults to "Charge". Reference and notes are optional.

### Settings — `/settings`
- `showroomName` — the only mandatory field on the whole settings screen.
- Currency, timezone, and odometer unit are not mandatory in the schema, but
  each carries a sensible default (INR / Asia/Kolkata / km) so the app never
  ends up with a blank currency.

### Staff account — `/settings` (staff)
- `email`, `name`, `role`
- Phone is optional. "Active" defaults to true.

## Conditional / business-rule requirements not visible in a form schema

These are enforced in API route handlers rather than in the Zod input
schema, because they depend on *which action* is being taken, not on the
shape of the record itself:

| Action | Endpoint | Requires |
|---|---|---|
| Approve an acquisition | `POST /api/acquisitions/[id]` (`action: "approve"`) | `agreedPrice` |
| Mark an acquisition acquired | `POST /api/acquisitions/[id]` (`action: "acquire"`) | `purchasePrice` and `purchaseDate` |
| Reject an acquisition | `POST /api/acquisitions/[id]` (`action: "reject"`) | `reason` |
| Change an acquisition's status | `POST /api/acquisitions/[id]` (`action: "status"`) | `status` |
| Upload media | `POST /api/media/upload` | a file |

## What "optional" actually means at write time

An optional field left blank in the browser reaches the server as `""` from
a text input or `null` from a number input. Both collapse to `undefined`
before any type check runs (`blankToUndefined` in `src/lib/schema.ts`), so a
blank field is stored as an empty string / zero / the field's stated default
— never as a validation failure. This was a real defect until it was fixed:
an empty number input posting `null` used to be rejected outright by
`optionalMoney`, `optionalMoneyInput`, `optionalCount`, and
`optionalWholeNumber` (see `docs/DECISIONS.md` / the commit that added
`tests/blank-null-fields.test.ts`), because those four helpers checked for
blank *inside* a transform that a `null` value never reached.
