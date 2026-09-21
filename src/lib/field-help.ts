import type { FieldHelpContent } from "@/components/ui/field-help";

/**
 * Explanatory help for every form field, shown in the popover beside its label.
 *
 * Keyed by the field's visible label, optionally namespaced by form scope
 * ("scope:Label") where the same label means different things — "Name" is a
 * seller on an enquiry, a vendor on a vendor form and a staff member in
 * settings. Lookup tries the scoped key first, then the bare label.
 *
 * Keeping the text here rather than inline in each form means the wording for a
 * concept is written once, and a field cannot end up documented two ways.
 */
export const FIELD_HELP: Record<string, FieldHelpContent> = {
  /* ---------- People and contact ---------- */
  "Seller name": {
    what: "The seller's full name, as it appears on the RC and their ID.",
    example: "Lakshmi Narayan",
    note: "Used on the purchase record. A mismatch with the RC slows the transfer."
  },
  "Vendor name": { what: "The workshop or supplier's trading name.", example: "Sharma Auto Works" },
  "Staff name": { what: "The staff member's name as it should appear in activity history.", example: "Arun Kumar" },
  "Seller phone": {
    what: "The seller's contact number. Kept as text so leading zeros and +91 survive.",
    example: "9845012345",
    note: "Sellers are matched on phone, so an accurate number avoids duplicate records."
  },
  "Seller alt phone": { what: "A second number for the seller.", example: "080 4000 4000" },
  "Seller email": { what: "Seller's email. Optional - leave blank if they do not use email.", example: "name@example.com" },
  "Seller address": { what: "Where the seller lives. Enough to arrange pickup and paperwork.", example: "Malleshwaram, Bengaluru" },
  "Vendor phone": { what: "Who to ring at this workshop or supplier.", example: "9123456780" },
  "Vendor email": { what: "Email for quotes and invoices. Optional.", example: "work@example.com" },
  "Staff phone": { what: "Contact number for this staff member. Optional.", example: "9845012345" },
  "Showroom phone": { what: "Your main number, shown on customer copies.", example: "+91 80 4000 4000" },
  "Showroom email": { what: "Your business email, shown on customer copies.", example: "hello@royalcars.in" },
  "Accessory notes": { what: "Anything worth recording about this accessory.", example: "Customer asked for it before booking" },
  "Expense notes": { what: "Anything worth recording about this cost.", example: "Pickup from the seller's home" },
  Phone: {
    what: "Primary contact number. Kept as text so leading zeros and +91 are preserved.",
    example: "9845012345",
    note: "Customers and sellers are matched on phone, so an accurate number avoids duplicate records."
  },
  "Alt phone": { what: "A second number to try if the first does not answer.", example: "080 4000 4000" },
  Email: { what: "Email address. Optional — leave blank if they do not use email.", example: "name@example.com" },
  Address: { what: "Where they live or trade. Enough to find them for paperwork or pickup.", example: "Malleshwaram, Bengaluru" },
  "Customer name": { what: "The buyer's full name, as it should read on the sale document.", example: "Rahul Verma" },
  "Customer phone": {
    what: "The buyer's contact number.",
    example: "9900112233",
    note: "If this number already exists, the sale attaches to that customer instead of creating a duplicate."
  },

  /* ---------- Vehicle identity ---------- */
  Make: { what: "Manufacturer of the car.", example: "Maruti Suzuki" },
  Model: { what: "Model name, without the variant.", example: "Swift" },
  Variant: { what: "Trim level, exactly as on the RC or brochure.", example: "ZXi+", note: "Affects resale value — worth getting right." },
  "Manufacture year": { what: "Year the car was built, from the VIN or manufacturer plate.", example: "2019", note: "Often a year earlier than the registration year." },
  "Registration year": { what: "Year the car was first registered with the RTO.", example: "2019", note: "Buyers usually judge age by this year." },
  Fuel: { what: "What the car runs on.", example: "Petrol" },
  Transmission: { what: "Gearbox type.", example: "Manual" },
  "Body type": { what: "Body style.", example: "Hatchback" },
  Colour: { what: "Exterior colour, using the manufacturer's name where you know it.", example: "Pearl White" },
  "Odometer (km)": { what: "Current odometer reading in kilometres.", example: "42500", note: "Whole kilometres, no commas. Record the true reading — it is checked again at every inspection." },
  "Odometer at delivery (km)": { what: "The reading at the moment you hand the car over.", example: "42550", note: "Fixes the start point for any distance-limited service commitment." },
  Owners: { what: "How many people owned the car before you, from the RC.", example: "1", note: "Count previous owners only, not the showroom." },
  "Registration number": { what: "The number plate, no spaces.", example: "KA03MJ8842", note: "Used to spot duplicates, so enter it exactly." },
  "VIN/chassis": { what: "17-character chassis number from the RC or door frame.", example: "MA3EZEBS123456789" },
  "Engine no.": { what: "Engine number from the RC.", example: "G12B987654" },
  "Registered at": { what: "RTO where the car is registered.", example: "Bengaluru Central", note: "Matters for transfer paperwork and NOC if the buyer is in another state." },
  Vehicle: { what: "Which car this record belongs to.", example: "STK-00001 — Maruti Suzuki Swift", note: "Pick by stock number; every cost and document hangs off this link." },
  "Interested vehicle": { what: "The car this buyer is asking about. Leave as Any if they are still browsing.", example: "STK-00002 — Hyundai i20" },

  /* ---------- Acquisition ---------- */
  "Lead source": { what: "How this seller reached you. Tells you which channels bring in stock.", example: "OLX/Portals" },
  Source: { what: "How this buyer reached you. Used to judge which channels are worth paying for.", example: "Website" },
  "Expected price (₹)": { what: "What the seller is asking, before you negotiate.", example: "450000", note: "Rupees, not paise. Their opening number — the agreed price is recorded separately." },
  "Agree purchase price (₹) — marks case Approved": {
    what: "The price you have agreed to pay the seller.",
    example: "430000",
    note: "Approves the case. This becomes the purchase liability you pay down, and the base of the car's investment."
  },
  "Actual purchase price (₹)": { what: "The final price paid for the car.", example: "430000", note: "Confidential — hidden from the sales role." },
  "Purchase / receiving date": { what: "The date you took the car in.", example: "2026-07-08", note: "Starts the stock-ageing clock." },
  "Inspection appointment": { what: "When the pre-purchase inspection is booked.", example: "2026-07-05 11:00" },
  "Follow-up date": { what: "When to chase this seller next. Overdue follow-ups appear on the dashboard.", example: "2026-07-12" },
  "Negotiation notes": { what: "What was discussed, and what the seller will and will not accept.", example: "Would not go below ₹5.1L; has a second buyer." },
  "Note / reason": { what: "Why you are making this change. Kept in the activity history.", example: "Seller accepted ₹4.3L after second inspection" },
  "Reject / cancel reason": { what: "Why you are not buying this car. It stays searchable so you can answer the seller later.", example: "Price gap too wide; accident history reported" },

  /* ---------- Inspection ---------- */
  Type: { what: "Which inspection this is in the car's life.", example: "Pre-purchase", note: "A Receiving or Pre-delivery inspection is required before a car can be marked Ready for sale." },
  "Overall result": { what: "Your verdict for the whole car.", example: "Pass with findings" },
  "Estimated repair (₹)": { what: "What you think the findings will cost to put right.", example: "26500", note: "An estimate only — it never counts as a cost. Costs come from completed work orders." },
  "Accident history": {
    what: "Whether the car has been in an accident, and how sure you are.",
    example: "Reported",
    note: "Unknown means you have not checked. Never record Unknown as None — 'no accident history' affects the price you can ask."
  },
  "Flood history": { what: "Whether the car has been flood-damaged, and how sure you are.", example: "Unknown", note: "Same rule as accident history: missing information is not a No." },
  "Recommended work": { what: "What you advise doing before the car is sold.", example: "Front tyres, AC service, full polish" },
  Area: { what: "The part of the car this finding is about.", example: "Brakes" },
  Condition: { what: "How that area rates.", example: "Needs repair", note: "Use Not inspected honestly — it is more useful than a guess." },
  Finding: { what: "What you actually saw.", example: "Front pads at 20%, discs scored" },
  "Est. cost ₹": { what: "Rough cost to fix this one finding.", example: "4500", note: "Tick the work-order box to carry it into a job; it still is not a cost until that job completes." },

  /* ---------- Work, parts and expenses ---------- */
  Stage: { what: "Where in the car's life this work happens.", example: "Inventory preparation", note: "After-sale work is tracked separately and does not change the car's pre-sale investment." },
  Issue: { what: "The problem in plain words.", example: "Tyres worn near limit; AC cooling weak" },
  "Required work": { what: "What needs doing about it.", example: "Replace 2 front tyres, AC gas top-up" },
  "Work category": { what: "Type of work, for grouping costs in reports.", example: "Tyres" },
  "Expense category": { what: "What kind of cost this is.", example: "Transportation", note: "Repair and Accessories are excluded here — those amounts already arrive through work orders and the accessories list." },
  "Vendor category": { what: "What this vendor does, so you can find them quickly.", example: "Workshop" },
  "Vendor / workshop": { what: "Who is doing the work. Leave blank for in-house jobs.", example: "Sharma Auto Works" },
  "Estimated cost (₹)": { what: "The quote before work starts.", example: "24000", note: "Estimates never affect the car's investment — only the actual cost on completion does." },
  "Start date": { what: "When work began.", example: "2026-07-10" },
  "Expected completion": { what: "When the vendor promised it back.", example: "2026-07-13", note: "Open jobs block a car from being marked Ready for sale." },
  "Linked follow-up WO ref": { what: "If this job follows an earlier one, its reference. Keeps the history joined up rather than overwritten.", example: "WO-00012" },
  Payer: {
    what: "Who actually pays for this.",
    example: "Showroom",
    note: "Only Showroom-paid amounts count as your cost. Customer- or seller-paid work is recorded but never added to the car's investment."
  },
  Item: { what: "The accessory fitted.", example: "Dashcam" },
  Quantity: { what: "How many.", example: "1" },
  "Unit cost (₹)": { what: "Price for one, before multiplying by quantity.", example: "6500" },
  "Installed on": { what: "Date it was fitted.", example: "2026-07-14" },
  "Included in work order": {
    what: "Tick if this accessory is already billed inside a work order's invoice.",
    example: "Ticked for seat covers on WO-00003",
    note: "Ticking it stops the amount being counted twice. It still shows on the car's money trail, marked as not counted again."
  },
  "Amount (₹)": { what: "The amount in rupees.", example: "2500", note: "Rupees, not paise. Commas and ₹ are fine — they are stripped." },
  "Parts (₹)": { what: "Cost of parts only.", example: "800" },
  "Labour (₹)": { what: "Cost of labour only.", example: "700" },

  /* ---------- Money in and out ---------- */
  Method: { what: "How the money moved.", example: "NEFT/RTGS" },
  Reference: { what: "Transaction or cheque number, so the payment can be traced in the bank statement.", example: "NEFT-994211" },
  Date: { what: "The date this happened.", example: "2026-08-07", note: "The business date, which may differ from when you type it in." },
  "Agreed price (₹)": { what: "The price agreed with the buyer at booking.", example: "680000" },
  "Booking amount (₹)": { what: "Token amount taken to hold the car.", example: "25000", note: "Carries into the sale balance automatically — never collect or record it twice." },
  "Booking date": { what: "When the booking was taken.", example: "2026-08-02" },
  "Expires on": { what: "When the booking lapses if the sale does not go ahead.", example: "2026-08-16", note: "After this the car can be released to another buyer." },
  Terms: { what: "Any conditions attached to the booking.", example: "Subject to finance approval" },
  "Convert from reservation": { what: "The booking this sale comes from. Picking it carries the booking amount across.", example: "RES-00001" },
  "Final net price (₹)": {
    what: "The agreed sale price after any discount — the figure the customer actually pays.",
    example: "482000",
    note: "Subtract a discount once, here. Profit is measured against this number."
  },
  "Sale date": { what: "The date the sale was agreed.", example: "2026-08-06", note: "Reports group sales by this date." },
  "Payment terms": { what: "How and when the balance will be paid.", example: "₹2L down, balance in 7 days" },
  "Budget (₹)": { what: "Roughly what the buyer wants to spend. Used to match them to stock.", example: "480000" },

  /* ---------- Delivery ---------- */
  "Delivery date": { what: "The date the car is handed over.", example: "2026-08-21" },
  "Customer instructions": { what: "Anything the buyer should know after driving away.", example: "First free service at 1,000 km" },
  Reason: { what: "Why this is being done. Kept in the record so the decision can be explained later.", example: "Owner approved delivery with balance on credit" },

  /* ---------- After-sale ---------- */
  Sale: { what: "Which sale this service request belongs to.", example: "SAL-00001 — Rahul Verma" },
  Complaint: { what: "The problem in the customer's own words.", example: "AC not cooling after one week of use" },
  "Reported date": { what: "When the customer told you.", example: "2026-08-31" },
  Priority: { what: "How urgent this is.", example: "Normal" },
  Appointment: { what: "When the car is booked in.", example: "2026-09-02 10:30" },
  "Schedule appointment": { what: "When to bring the car in.", example: "2026-09-02 10:30" },
  "Coverage decision": {
    what: "Who pays for this work.",
    example: "Covered",
    note: "Covered means a commitment you made at sale. Customer billable creates a charge tracked separately from the car sale."
  },
  "Work done": { what: "What was actually carried out.", example: "AC gas top-up and valve tightening" },
  Diagnosis: { what: "What you found to be causing the complaint.", example: "Low refrigerant from a loose valve" },
  "Completion notes": { what: "Anything worth recording now the job is finished.", example: "Leak test passed; advised re-check in 6 months" },
  "Reopen reason": { what: "Why this request is being reopened.", example: "Same fault returned within two weeks" },

  /* ---------- Settings ---------- */
  "Showroom name": { what: "Your business name, as it should appear on customer documents.", example: "Royal Cars" },
  Tagline: { what: "A short line under the name on printed copies.", example: "Trusted pre-owned cars since 2012" },
  WhatsApp: { what: "WhatsApp number, if it differs from your main phone.", example: "9845012345" },
  Currency: { what: "Currency for all amounts.", example: "INR", note: "Changing this does not convert existing figures." },
  Timezone: { what: "Timezone used for dates and reports.", example: "Asia/Kolkata" },
  "Odometer unit": { what: "Unit for distances.", example: "km" },
  "Service defaults": { what: "The service commitment you normally offer, pre-filled on new sales.", example: "1 free service within 30 days or 1,000 km", note: "A default only — nothing is promised to a customer unless you record it on their sale." },
  Role: {
    what: "What this person can see and do.",
    example: "Sales",
    note: "Sales cannot see purchase cost or profit. Operations cannot see identity documents. Owner sees everything."
  },
  "Staff email": { what: "Their Google account address. Only addresses listed here can sign in.", example: "arun@royalcars.in", note: "Sign-in is allowlist-only; there is no self-registration." },

  /* ---------- Import ---------- */
  Entity: { what: "What kind of records this file contains.", example: "Vehicles" },
  Mode: {
    what: "What to do when a row matches an existing record.",
    example: "Upsert",
    note: "Upsert updates the match. Create only reports it as an error and changes nothing."
  },

  /* ---------- Generic ---------- */
  Notes: { what: "Anything else worth recording. Free text, visible to staff.", example: "Single owner, full service history at dealer" },
  Customer: { what: "Which customer this belongs to.", example: "Rahul Verma — 9900112233" }
};

/** Resolves help for a label, preferring a form-scoped entry. */
export function lookupFieldHelp(label: string): FieldHelpContent | undefined {
  return FIELD_HELP[label];
}
