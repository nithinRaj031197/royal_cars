/**
 * Fictional demo/seed dataset covering the whole vehicle lifecycle.
 *
 * Used two ways:
 *  - `pnpm sheets:seed` writes it into a real (or demo) store, and
 *  - in DEMO_MODE the in-memory store seeds itself with it on first use, so the
 *    dev server has a populated showroom without a separate seeding step.
 *
 * Everything here is invented. Never point this at a spreadsheet holding real
 * customer data: it only ever appends, but the records are fake.
 */
import type { DataStore } from "@/lib/store/types";

export let DEMO_OWNER_PASSWORD = "";

export async function seedDemoData(store: DataStore): Promise<void> {
  const ACTOR = "seed@royalcars.demo";
  const ctx = { actor: ACTOR };
  const C = (n: number) => String(Math.round(n * 100));

  // ---------- Staff ----------
  const staff = [
    { email: "owner@royalcars.demo", name: "Priya Owner", role: "owner" },
    { email: "sales@royalcars.demo", role: "sales", name: "Arun Sales" },
    { email: "ops@royalcars.demo", name: "Divya Ops", role: "operations" },
    { email: "accounts@royalcars.demo", name: "Karthik Accounts", role: "accounts" }
  ];
  // The demo owner can sign in with a known password; the other roles exist in
  // the data but sign-in is currently limited to owners (LOGIN_ENABLED_ROLES).
  const { hashPassword } = await import("./auth/password");
  const demoOwnerPassword = "Showroom-Demo-2026";
  const ownerHash = await hashPassword(demoOwnerPassword);
  for (const s of staff) {
    await store.create(
      "Staff",
      {
        ...s,
        phone: "",
        active: "TRUE",
        googleSub: "",
        lastLoginAt: "",
        passwordHash: s.role === "owner" ? ownerHash : "",
        passwordSetAt: s.role === "owner" ? new Date().toISOString() : "",
        mustChangePassword: "FALSE",
        failedAttempts: "0",
        lockedUntil: ""
      },
      ctx
    );
  }
  DEMO_OWNER_PASSWORD = demoOwnerPassword;

  // ---------- Vendors ----------
  const vendor1 = await store.create("Vendors", { name: "Sharma Auto Works", category: "Workshop", phone: "9123456780", email: "", address: "Peenya, Bengaluru", gst: "", notes: "", preferred: "TRUE" }, ctx);
  const vendor2 = await store.create("Vendors", { name: "Clean Ride Detailing", category: "Detailing", phone: "9123456781", email: "", address: "HSR Layout, Bengaluru", gst: "", notes: "", preferred: "FALSE" }, ctx);
  void vendor2;

  // ---------- Settings ----------
  await store.create("Settings", { id: "showroom:showroomName", value: "Royal Cars" }, ctx);
  await store.create("Settings", { id: "showroom:phone", value: "+91 80 4000 4000" }, ctx);
  await store.create("Settings", { id: "showroom:currency", value: "INR" }, ctx);
  await store.create("Settings", { id: "showroom:timezone", value: "Asia/Kolkata" }, ctx);
  await store.create("Settings", { id: "ref:STK", value: "2" }, ctx);
  await store.create("Settings", { id: "ref:ACQ", value: "2" }, ctx);
  await store.create("Settings", { id: "ref:SAL", value: "1" }, ctx);
  await store.create("Settings", { id: "ref:RES", value: "1" }, ctx);

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  // =====================================================================
  // Storyline (fictional):
  //  STK-00001 Maruti Swift  → full lifecycle: bought, prepared, sold, delivered, after-sale
  //  STK-00002 Hyundai i20   → in preparation (work orders open)
  //  ACQ-00003 Honda City    → rejected enquiry (remains searchable, not in inventory)
  // =====================================================================

  // ---------- Rejected enquiry (Honda City) ----------
  const sellerR = await store.create("Sellers", { name: "Mohan Rao", phone: "9812345670", altPhone: "", email: "", address: "Jayanagar, Bengaluru", leadSource: "Referral", notes: "" }, ctx);
  const vehicleR = await store.create("Vehicles", {
    stockRef: "—", registrationNumber: "KA05MV9911", vin: "", engineNumber: "",
    make: "Honda", model: "City", variant: "SV", manufactureYear: "2015", registrationYear: "2015",
    fuel: "Petrol", transmission: "Manual", bodyType: "Sedan", colour: "Silver", ownershipCount: "1",
    odometerKm: "88000", registrationLocation: "Bengaluru East", showroomLocation: "",
    sellerId: sellerR.id, acquisitionCaseId: "", purchaseDate: "", purchasePricePaise: "0",
    receivingDate: "", lifecycleState: "In acquisition pipeline", publicationState: "Not published",
    acquisitionNotes: "Seller asking too high; chose another buyer.", askingPricePaise: "0",
    currentAskingPaise: "0", minimumPricePaise: "0", finalSalePricePaise: "0",
    publicSlug: "", publicTitle: "", publicDescription: "", publicFeatures: "", seoTitle: "", seoDescription: "", publishedAt: ""
  }, ctx);
  const caseR = await store.create("AcquisitionCases", {
    caseRef: "ACQ-00003", vehicleId: vehicleR.id, sellerId: sellerR.id, status: "Rejected",
    leadSource: "Referral", expectedPricePaise: C(525000), offeredPricePaise: C(430000),
    agreedPricePaise: "0", assignedTo: "ops@royalcars.demo", followUpDate: "", negotiationNotes: "Seller would not come below ₹5.1L.",
    inspectionAppointmentAt: "", closeReason: "Rejected: price gap too wide; minor front-left accident history reported.",
    closedAt: new Date().toISOString()
  }, ctx);
  await store.update("Vehicles", vehicleR.id, { acquisitionCaseId: caseR.id, stockRef: "—" }, vehicleR.version, ctx);
  await store.create("Inspections", {
    inspectionRef: "INS-SEED1", vehicleId: vehicleR.id, acquisitionCaseId: caseR.id, type: "Pre-purchase",
    inspectedBy: "ops@royalcars.demo", date: daysAgo(20), odometerKm: "88000", overallResult: "Pass with findings",
    estimatedRepairPaise: C(38000), recommendedWork: "Front bumper repaint; suspension bush kit",
    notes: "Paint thickness uneven on front-left; seller denies repaint.", accidentHistory: "Reported", floodHistory: "Unknown"
  }, ctx);

  // ---------- STK-00001: Swift full lifecycle ----------
  const seller1 = await store.create("Sellers", { name: "Lakshmi Narayan", phone: "9845012345", altPhone: "", email: "", address: "Malleshwaram, Bengaluru", leadSource: "OLX/Portals", notes: "" }, ctx);
  const v1 = await store.create("Vehicles", {
    stockRef: "STK-00001", registrationNumber: "KA03MJ8842", vin: "MA3EZEBS123456", engineNumber: "G12B987654",
    make: "Maruti Suzuki", model: "Swift", variant: "ZXi+", manufactureYear: "2019", registrationYear: "2019",
    fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback", colour: "Pearl White", ownershipCount: "1",
    odometerKm: "42500", registrationLocation: "Bengaluru Central", showroomLocation: "Main showroom",
    sellerId: seller1.id, acquisitionCaseId: "", purchaseDate: daysAgo(75), purchasePricePaise: C(430000),
    receivingDate: daysAgo(72), lifecycleState: "Delivered", publicationState: "Not published",
    acquisitionNotes: "Single owner, service history at dealer.", askingPricePaise: C(499000),
    currentAskingPaise: C(489000), minimumPricePaise: C(455000), finalSalePricePaise: C(482000),
    publicSlug: "", publicTitle: "", publicDescription: "", publicFeatures: "", seoTitle: "", seoDescription: "", publishedAt: ""
  }, ctx);
  const case1 = await store.create("AcquisitionCases", {
    caseRef: "ACQ-00001", vehicleId: v1.id, sellerId: seller1.id, status: "Acquired",
    leadSource: "OLX/Portals", expectedPricePaise: C(450000), offeredPricePaise: C(420000),
    agreedPricePaise: C(430000), assignedTo: "ops@royalcars.demo", followUpDate: "",
    negotiationNotes: "Negotiated ₹20k off with immediate payment.", inspectionAppointmentAt: "",
    closeReason: "", closedAt: ""
  }, ctx);
  await store.update("Vehicles", v1.id, { acquisitionCaseId: case1.id }, v1.version, ctx);

  // Seller payments (two tranches)
  await store.create("PurchasePayments", {
    paymentRef: "PP-SEED01", acquisitionCaseId: case1.id, vehicleId: v1.id, sellerId: seller1.id,
    date: daysAgo(75), amountPaise: C(380000), method: "NEFT/RTGS", reference: "NEFT-881231", notes: "Advance at agreement", documentFileId: "", recordedBy: "accounts@royalcars.demo"
  }, ctx);
  await store.create("PurchasePayments", {
    paymentRef: "PP-SEED02", acquisitionCaseId: case1.id, vehicleId: v1.id, sellerId: seller1.id,
    date: daysAgo(72), amountPaise: C(50000), method: "Cash", reference: "", notes: "Balance at delivery of RC transfer docs", documentFileId: "", recordedBy: "accounts@royalcars.demo"
  }, ctx);

  // Inspections: pre-purchase, receiving, pre-delivery
  await store.create("Inspections", {
    inspectionRef: "INS-SEED2", vehicleId: v1.id, acquisitionCaseId: case1.id, type: "Pre-purchase",
    inspectedBy: "ops@royalcars.demo", date: daysAgo(80), odometerKm: "41980", overallResult: "Pass with findings",
    estimatedRepairPaise: C(26500), recommendedWork: "Front tyres, AC service, full polish",
    notes: "Clean history; original paint.", accidentHistory: "None", floodHistory: "None"
  }, ctx);
  const insp1 = await store.create("Inspections", {
    inspectionRef: "INS-SEED3", vehicleId: v1.id, acquisitionCaseId: case1.id, type: "Receiving",
    inspectedBy: "ops@royalcars.demo", date: daysAgo(72), odometerKm: "42310", overallResult: "Pass",
    estimatedRepairPaise: C(26500), recommendedWork: "", notes: "Documents verified; RC original.", accidentHistory: "None", floodHistory: "None"
  }, ctx);
  await store.create("Inspections", {
    inspectionRef: "INS-SEED4", vehicleId: v1.id, acquisitionCaseId: case1.id, type: "Pre-delivery",
    inspectedBy: "ops@royalcars.demo", date: daysAgo(28), odometerKm: "42550", overallResult: "Pass",
    estimatedRepairPaise: "0", recommendedWork: "", notes: "Ready for handover.", accidentHistory: "None", floodHistory: "None"
  }, ctx);
  void insp1;

  // Work orders: completed repair + completed detailing
  const wo1 = await store.create("WorkOrders", {
    workOrderRef: "WO-SEED01", vehicleId: v1.id, acquisitionCaseId: case1.id, saleId: "", stage: "Inventory preparation",
    issue: "Tyres worn near limit; AC cooling weak", requiredWork: "Replace 2 front tyres, AC service",
    category: "Tyres", vendorId: vendor1.id, assignedTo: "ops@royalcars.demo",
    estimatedPaise: C(24000), actualPaise: C(22400), partsPaise: C(18400), labourPaise: C(2400), otherPaise: C(0), taxPaise: C(1600), discountPaise: "0",
    startDate: daysAgo(70), expectedCompletionDate: daysAgo(67), completedOn: daysAgo(68),
    odometerKm: "42380", status: "Completed", payer: "Showroom", approvedBy: "owner@royalcars.demo",
    approvalNotes: "Approved as quoted", completionNotes: "Genuine CEAT tyres fitted.",
    invoiceNumber: "SAW-2231", invoiceAmountPaise: C(22400), invoiceDocumentId: "", linkedWorkOrderRef: ""
  }, ctx);
  const wo2 = await store.create("WorkOrders", {
    workOrderRef: "WO-SEED02", vehicleId: v1.id, acquisitionCaseId: case1.id, saleId: "", stage: "Pre-delivery",
    issue: "Cosmetic preparation for handover", requiredWork: "Full interior/exterior detailing",
    category: "Detailing", vendorId: vendor2.id, assignedTo: "ops@royalcars.demo",
    estimatedPaise: C(4500), actualPaise: C(4500), partsPaise: C(500), labourPaise: C(3500), otherPaise: C(0), taxPaise: C(500), discountPaise: "0",
    startDate: daysAgo(30), expectedCompletionDate: daysAgo(29), completedOn: daysAgo(29),
    odometerKm: "42540", status: "Completed", payer: "Showroom", approvedBy: "owner@royalcars.demo",
    approvalNotes: "", completionNotes: "", invoiceNumber: "CRD-118", invoiceAmountPaise: C(4500), invoiceDocumentId: "", linkedWorkOrderRef: ""
  }, ctx);
  void wo2;

  // Accessory NOT in work order (counts) + one included in WO (does not double count)
  await store.create("Accessories", {
    vehicleId: v1.id, acquisitionCaseId: case1.id, item: "Dashcam", quantity: "1", unitCostPaise: C(6500),
    totalPaise: C(6500), vendorId: "", installedOn: daysAgo(66), required: "FALSE", workOrderId: "",
    documentFileId: "", notes: "Customer asked before booking", payer: "Showroom"
  }, ctx);
  await store.create("Accessories", {
    vehicleId: v1.id, acquisitionCaseId: case1.id, item: "Seat covers (artificial leather)", quantity: "1",
    unitCostPaise: C(7000), totalPaise: C(7000), vendorId: vendor1.id, installedOn: daysAgo(68), required: "FALSE",
    workOrderId: String(wo1.workOrderRef ?? ""), documentFileId: "", notes: "Billed inside WO-SEED01 invoice", payer: "Showroom"
  }, ctx);

  // Other expense
  await store.create("Expenses", {
    expenseRef: "EXP-SEED01", vehicleId: v1.id, acquisitionCaseId: case1.id, saleId: "", serviceJobId: "",
    category: "Transportation", date: daysAgo(72), amountPaise: C(2500), payer: "Showroom", vendorId: "",
    reference: "TOW-0091", notes: "Pickup from seller home", documentFileId: "", recordedBy: "accounts@royalcars.demo"
  }, ctx);

  // Price history
  await store.create("PriceHistory", { vehicleId: v1.id, date: daysAgo(65), kind: "Asking", amountPaise: C(499000), previousPaise: "0", reason: "Initial listing", setBy: "owner@royalcars.demo" }, ctx);
  await store.create("PriceHistory", { vehicleId: v1.id, date: daysAgo(40), kind: "Current asking", amountPaise: C(489000), previousPaise: C(499000), reason: "Market feedback — 45+ days strategy", setBy: "owner@royalcars.demo" }, ctx);

  // Customer, lead, follow-ups, test drive
  const cust1 = await store.create("Customers", {
    name: "Rahul Verma", phone: "9900112233", altPhone: "", email: "rahul.verma@example.com",
    address: "Whitefield, Bengaluru", idType: "Aadhaar", idNumberMasked: "XXXX-XXXX-4432", dob: "", anniversary: "", notes: "Prefers white cars"
  }, ctx);
  await store.create("Leads", {
    leadRef: "LEAD-SEED01", customerId: cust1.id, vehicleId: v1.id, source: "Website",
    budgetPaise: C(480000), status: "Won", assignedTo: "sales@royalcars.demo", notes: "Finance via HDFC pre-approved"
  }, ctx);
  await store.create("FollowUps", { leadId: "", customerId: cust1.id, vehicleId: v1.id, dueDate: daysAgo(45), note: "Share detailed photos", status: "Done", outcome: "Sent via WhatsApp", completedAt: new Date().toISOString() }, ctx);
  await store.create("TestDrives", {
    driveRef: "TD-SEED01", leadId: "", customerId: cust1.id, vehicleId: v1.id,
    scheduledAt: new Date(Date.now() - 50 * 86_400_000).toISOString(), status: "Completed",
    outcome: "Booked", feedback: "Drove well; negotiated from asking", staffId: "sales@royalcars.demo", odometerBefore: "42400", odometerAfter: "42418"
  }, ctx);

  // Reservation → sale → payments → delivery
  const res1 = await store.create("Reservations", {
    reservationRef: "RES-SEED01", vehicleId: v1.id, customerId: cust1.id, agreedPricePaise: C(485000),
    bookingAmountPaise: C(25000), bookingDate: daysAgo(49), expiresOn: daysAgo(35), terms: "Subject to finance approval",
    notes: "", status: "Converted", cancelledReason: "", refundAmountPaise: "0", refundMethod: "", refundDate: "", convertedSaleId: ""
  }, ctx);
  const sale1 = await store.create("Sales", {
    saleRef: "SAL-SEED01", vehicleId: v1.id, customerId: cust1.id, salespersonId: "sales@royalcars.demo",
    reservationId: res1.id, finalNetPricePaise: C(482000), saleDate: daysAgo(45), paymentTerms: "₹2L down, balance in 7 days",
    deliveryDate: daysAgo(28), status: "Delivered", deliveryChecklistId: "", docsComplete: "TRUE", notes: "",
    cancelReason: "",
    snapshotInvestmentPaise: C(468400), snapshotPurchasePaise: C(430000), snapshotRepairsPaise: C(26900),
    snapshotAccessoriesPaise: C(6500), snapshotOtherPaise: C(2500), snapshotGrossProfitPaise: C(13600), snapshotAt: new Date().toISOString()
  }, ctx);
  await store.update("Reservations", res1.id, { convertedSaleId: sale1.id }, res1.version, ctx);
  await store.create("SalePayments", {
    paymentRef: "SP-SEED01", saleId: sale1.id, reservationId: res1.id, vehicleId: v1.id, customerId: cust1.id,
    date: daysAgo(49), kind: "Booking", amountPaise: C(25000), method: "Adjusted from booking", reference: "RES-SEED01",
    notes: "Booking amount transferred to sale balance", recordedBy: "accounts@royalcars.demo", voidedAt: "", voidReason: "", voidedBy: "", reversesPaymentId: ""
  }, ctx);
  await store.create("SalePayments", {
    paymentRef: "SP-SEED02", saleId: sale1.id, reservationId: "", vehicleId: v1.id, customerId: cust1.id,
    date: daysAgo(44), kind: "Part payment", amountPaise: C(200000), method: "NEFT/RTGS", reference: "NEFT-994211",
    notes: "Down payment", recordedBy: "accounts@royalcars.demo", voidedAt: "", voidReason: "", voidedBy: "", reversesPaymentId: ""
  }, ctx);
  await store.create("SalePayments", {
    paymentRef: "SP-SEED03", saleId: sale1.id, reservationId: "", vehicleId: v1.id, customerId: cust1.id,
    date: daysAgo(29), kind: "Final payment", amountPaise: C(257000), method: "NEFT/RTGS", reference: "NEFT-995009",
    notes: "Balance cleared", recordedBy: "accounts@royalcars.demo", voidedAt: "", voidReason: "", voidedBy: "", reversesPaymentId: ""
  }, ctx);

  // Delivery checklist
  const dl = await store.create("DeliveryChecklists", {
    checklistRef: "DLV-SEED01", saleId: sale1.id, vehicleId: v1.id, deliveryDate: daysAgo(28), odometerKm: "42550",
    itemsJson: JSON.stringify([
      { kind: "Final inspection", label: "Final inspection completed", mandatory: true, done: true, note: "" },
      { kind: "Promised repairs", label: "All promised repairs completed", mandatory: true, done: true, note: "" },
      { kind: "Cleaning & preparation", label: "Vehicle cleaned", mandatory: true, done: true, note: "" },
      { kind: "Keys & accessories", label: "Keys + dashcam handed over", mandatory: true, done: true, note: "" },
      { kind: "Required documents", label: "RC copy, insurance, sale bill given", mandatory: true, done: true, note: "" },
      { kind: "Payment review", label: "Full payment received", mandatory: true, done: true, note: "" },
      { kind: "Handover acknowledgement", label: "Customer signed acknowledgement", mandatory: true, done: true, note: "" }
    ]),
    allMandatoryDone: "TRUE", balanceOutstandingPaise: "0", exceptionApprovedBy: "", exceptionReason: "",
    acknowledgedBy: "sales@royalcars.demo", acknowledgedAt: new Date().toISOString(),
    instructions: "First free service at 1,000 km.", status: "Completed"
  }, ctx);
  await store.update("Sales", sale1.id, { deliveryChecklistId: dl.id }, sale1.version, ctx);

  // Service commitment + after-sale request (covered), job, closure
  await store.create("ServiceCommitments", {
    commitmentRef: "SC-SEED01", saleId: sale1.id, vehicleId: v1.id, customerId: cust1.id,
    kind: "Free service", coverage: "1 free service within 30 days or 1,000 km of delivery",
    exclusions: "Consumables and accidental damage", startDate: daysAgo(28), endDate: daysAgo(-2),
    odometerLimit: "1000", eligibleServices: "1", servicesUsed: "1", agreementDocumentId: "",
    approvalNotes: "Owner approved", status: "Active"
  }, ctx);
  const sr1 = await store.create("ServiceRequests", {
    requestRef: "SR-SEED01", saleId: sale1.id, vehicleId: v1.id, customerId: cust1.id,
    complaint: "AC not cooling after one week of use", reportedDate: daysAgo(18), odometerKm: "42620",
    priority: "Normal", appointmentAt: "", coverageDecision: "Covered", coverageReason: "Within free-service window; compressor gas top-up",
    assignedTo: "ops@royalcars.demo", vendorId: vendor1.id, diagnosis: "Low refrigerant due to loose valve",
    workOrderId: "", partsPaise: C(800), labourPaise: C(700), actualCostPaise: C(1500), payer: "Showroom",
    customerChargePaise: "0", completionNotes: "Gas refilled; leak test passed.", customerAcknowledged: "TRUE",
    nextFollowUpDate: daysAgo(-20), status: "Resolved", cancelledReason: "", reopenedFromId: ""
  }, ctx);
  await store.create("ServiceJobs", {
    jobRef: "SJ-SEED01", serviceRequestId: sr1.id, vehicleId: v1.id, date: daysAgo(17), odometerKm: "42620",
    workDone: "AC gas top-up and valve tightening", partsPaise: C(800), labourPaise: C(700), totalPaise: C(1500),
    vendorId: vendor1.id, staffId: "ops@royalcars.demo", chargesPaymentId: "", status: "Completed"
  }, ctx);

  // ---------- STK-00002: i20 in preparation ----------
  const seller2 = await store.create("Sellers", { name: "Farhan Ahmed", phone: "9880011223", altPhone: "", email: "", address: "Frazer Town, Bengaluru", leadSource: "Walk-in", notes: "" }, ctx);
  const v2 = await store.create("Vehicles", {
    stockRef: "STK-00002", registrationNumber: "KA01MR7712", vin: "", engineNumber: "",
    make: "Hyundai", model: "i20", variant: "Asta (O)", manufactureYear: "2021", registrationYear: "2021",
    fuel: "Diesel", transmission: "Manual", bodyType: "Hatchback", colour: "Titan Grey", ownershipCount: "1",
    odometerKm: "31200", registrationLocation: "Bengaluru East", showroomLocation: "Main showroom",
    sellerId: seller2.id, acquisitionCaseId: "", purchaseDate: daysAgo(20), purchasePricePaise: C(710000),
    receivingDate: daysAgo(18), lifecycleState: "In preparation", publicationState: "Not published",
    acquisitionNotes: "", askingPricePaise: C(799000), currentAskingPaise: C(799000), minimumPricePaise: C(745000),
    finalSalePricePaise: "0", publicSlug: "", publicTitle: "", publicDescription: "", publicFeatures: "", seoTitle: "", seoDescription: "", publishedAt: ""
  }, ctx);
  const case2 = await store.create("AcquisitionCases", {
    caseRef: "ACQ-00002", vehicleId: v2.id, sellerId: seller2.id, status: "Acquired",
    leadSource: "Walk-in", expectedPricePaise: C(735000), offeredPricePaise: C(700000), agreedPricePaise: C(710000),
    assignedTo: "ops@royalcars.demo", followUpDate: "", negotiationNotes: "", inspectionAppointmentAt: "",
    closeReason: "", closedAt: ""
  }, ctx);
  await store.update("Vehicles", v2.id, { acquisitionCaseId: case2.id }, v2.version, ctx);
  await store.create("PurchasePayments", {
    paymentRef: "PP-SEED03", acquisitionCaseId: case2.id, vehicleId: v2.id, sellerId: seller2.id,
    date: daysAgo(20), amountPaise: C(710000), method: "NEFT/RTGS", reference: "NEFT-997001", notes: "Full and final",
    documentFileId: "", recordedBy: "accounts@royalcars.demo"
  }, ctx);
  await store.create("WorkOrders", {
    workOrderRef: "WO-SEED03", vehicleId: v2.id, acquisitionCaseId: case2.id, saleId: "", stage: "Inventory preparation",
    issue: "Rear bumper scuff; left alloy kerbed", requiredWork: "Bumper repaint + alloy refurbish",
    category: "Body shop", vendorId: vendor1.id, assignedTo: "ops@royalcars.demo",
    estimatedPaise: C(12000), actualPaise: "0", partsPaise: "0", labourPaise: "0", otherPaise: "0", taxPaise: "0", discountPaise: "0",
    startDate: daysAgo(5), expectedCompletionDate: daysAgo(-2), completedOn: "", odometerKm: "31240",
    status: "In progress", payer: "Showroom", approvedBy: "owner@royalcars.demo", approvalNotes: "",
    completionNotes: "", invoiceNumber: "", invoiceAmountPaise: "0", invoiceDocumentId: "", linkedWorkOrderRef: ""
  }, ctx);

  // ---------- Future website projection fields on STK-00002 ----------
  await store.update("Vehicles", v2.id, {
    publicSlug: "hyundai-i20-asta-2021-grey",
    publicTitle: "2021 Hyundai i20 Asta (O) Diesel",
    publicationState: "Approved for website"
  }, v2.version + 1, ctx);

}

export const DEMO_LOGIN_PROFILES = [
  { email: "owner@royalcars.demo", name: "Priya Owner", role: "owner" as const },
  { email: "sales@royalcars.demo", name: "Arun Sales", role: "sales" as const },
  { email: "ops@royalcars.demo", name: "Divya Ops", role: "operations" as const },
  { email: "accounts@royalcars.demo", name: "Karthik Accounts", role: "accounts" as const }
];
