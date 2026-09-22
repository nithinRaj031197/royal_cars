/**
 * Form payload contracts.
 *
 * Every screen posts what an HTML form produces: a flat object of STRINGS, with
 * "" for anything the user left alone — never `undefined`. That distinction has
 * already caused one live bug (`z.string().email().optional().default("")`
 * rejects both "" and undefined, so the field could never be left blank), and
 * it is the thing most likely to break again now that most fields are optional.
 *
 * For each schema these tests assert three properties:
 *
 *   1. a blank form parses — every optional field tolerates ""
 *   2. omitting a field and sending it as "" mean the same thing
 *   3. the fields that are genuinely required still are
 *
 * The REQUIRED lists below are the contract. Adding a field to one is a
 * deliberate decision to block a save; it should not happen by accident.
 */
import { describe, it, expect } from "vitest";
import type { ZodTypeAny } from "zod";
import * as S from "@/lib/form-schemas";

type Case = {
  name: string;
  schema: ZodTypeAny;
  /** Smallest payload that must be accepted. */
  minimal: Record<string, unknown>;
  /** Every other field a form would post, as a user might fill them. */
  filled: Record<string, unknown>;
  /** Keys that must NOT be satisfiable by "" — the structural ones. */
  required: string[];
};

const today = "2026-09-22";

const CASES: Case[] = [
  {
    name: "enquiry",
    schema: S.enquiryInputSchema,
    minimal: { sellerName: "Paper Record", make: "Maruti" },
    filled: {
      sellerName: "Lakshmi", sellerPhone: "9845012345", sellerAltPhone: "080 4000 4000",
      sellerEmail: "l@example.com", sellerAddress: "Malleshwaram", leadSource: "Walk-in",
      make: "Maruti", model: "Swift", variant: "ZXi+", manufactureYear: "2019",
      registrationYear: "2019", fuel: "Petrol", transmission: "Manual", bodyType: "Hatchback",
      colour: "White", odometerKm: "42500", ownershipCount: "1", registrationNumber: "KA03MJ8842",
      vin: "MA3EZEBS123456", engineNumber: "G12B987654", registrationLocation: "Bengaluru",
      expectedPrice: "450000", inspectionAppointmentAt: "", followUpDate: today,
      negotiationNotes: "Wants a quick sale"
    },
    // Enforced as "at least one of" pairs rather than single fields.
    required: []
  },
  {
    name: "customer",
    schema: S.customerInputSchema,
    minimal: { name: "Rahul Verma" },
    filled: {
      name: "Rahul Verma", phone: "9900112233", altPhone: "", email: "r@example.com",
      address: "Whitefield", idType: "Aadhaar", idNumberMasked: "XXXX-4432", notes: "Prefers white"
    },
    required: []
  },
  {
    name: "vendor",
    schema: S.customerInputSchema, // vendors reuse the same shape of contact fields
    minimal: { name: "Sharma Auto Works" },
    filled: { name: "Sharma Auto Works", phone: "9123456780", email: "", address: "Peenya" },
    required: []
  },
  {
    name: "inspection",
    schema: S.inspectionInputSchema,
    minimal: { vehicleId: "veh-1", type: "Pre-purchase", date: today, overallResult: "Pass" },
    filled: {
      vehicleId: "veh-1", acquisitionCaseId: "acq-1", type: "Receiving", date: today,
      odometerKm: "42500", overallResult: "Pass with findings", estimatedRepair: "26500",
      recommendedWork: "Front tyres", notes: "Clean history",
      accidentHistory: "Reported", floodHistory: "Unknown", items: []
    },
    required: ["vehicleId"]
  },
  {
    name: "work order",
    schema: S.workOrderInputSchema,
    minimal: { vehicleId: "veh-1", stage: "Inventory preparation" },
    filled: {
      vehicleId: "veh-1", acquisitionCaseId: "", saleId: "", stage: "Pre-delivery",
      issue: "Tyres worn", requiredWork: "Replace 2 front tyres", category: "Tyres",
      vendorId: "ven-1", assignedTo: "ops@royalcars.in", estimated: "24000",
      startDate: today, expectedCompletionDate: today, odometerKm: "42380",
      payer: "Showroom", linkedWorkOrderRef: ""
    },
    required: ["vehicleId"]
  },
  {
    name: "accessory",
    schema: S.accessoryInputSchema,
    minimal: { vehicleId: "veh-1", unitCost: "6500" },
    filled: {
      vehicleId: "veh-1", item: "Dashcam", quantity: "1", unitCost: "6500", vendorId: "",
      installedOn: today, required: false, workOrderId: "", payer: "Showroom", notes: ""
    },
    required: ["vehicleId", "unitCost"]
  },
  {
    name: "expense",
    schema: S.expenseInputSchema,
    minimal: { vehicleId: "veh-1", category: "Transportation", date: today, amount: "2500" },
    filled: {
      vehicleId: "veh-1", saleId: "", serviceJobId: "", category: "Insurance", date: today,
      amount: "9000", payer: "Customer", vendorId: "", reference: "INS-1", notes: ""
    },
    required: ["vehicleId", "category", "date", "amount"]
  },
  {
    name: "lead",
    schema: S.leadInputSchema,
    minimal: { customerId: "cus-1", source: "Walk-in" },
    filled: {
      customerId: "cus-1", vehicleId: "veh-1", source: "Website", budget: "480000",
      status: "New", assignedTo: "sales@royalcars.in", notes: "Finance pre-approved"
    },
    required: ["customerId", "source"]
  },
  {
    name: "follow-up",
    schema: S.followUpInputSchema,
    minimal: { customerId: "cus-1", dueDate: today },
    filled: { leadId: "lead-1", customerId: "cus-1", vehicleId: "veh-1", dueDate: today, note: "Call back", status: "Open" },
    required: ["customerId", "dueDate"]
  },
  {
    name: "reservation",
    schema: S.reservationInputSchema,
    minimal: { vehicleId: "veh-1", agreedPrice: "680000", bookingAmount: "25000", bookingDate: today },
    filled: {
      vehicleId: "veh-1", customerName: "Rahul", customerPhone: "9900112233",
      agreedPrice: "680000", bookingAmount: "25000", bookingDate: today, expiresOn: today,
      terms: "Subject to finance", notes: ""
    },
    required: ["vehicleId", "agreedPrice", "bookingAmount", "bookingDate"]
  },
  {
    name: "sale",
    schema: S.saleInputSchema,
    minimal: { vehicleId: "veh-1", finalNetPrice: "482000", saleDate: today },
    filled: {
      vehicleId: "veh-1", customerName: "Rahul", customerPhone: "9900112233",
      reservationId: "res-1", finalNetPrice: "482000", saleDate: today,
      paymentTerms: "2L down", notes: ""
    },
    required: ["vehicleId", "finalNetPrice", "saleDate"]
  },
  {
    name: "sale payment",
    schema: S.salePaymentInputSchema,
    minimal: { saleId: "sale-1", date: today, amount: "200000", method: "Cash" },
    filled: {
      saleId: "sale-1", date: today, kind: "Part payment", amount: "200000",
      method: "NEFT/RTGS", reference: "NEFT-994211", notes: "", idempotencyKey: ""
    },
    required: ["saleId", "date", "amount", "method"]
  },
  {
    name: "purchase payment",
    schema: S.purchasePaymentInputSchema,
    minimal: { acquisitionCaseId: "acq-1", date: today, amount: "380000", method: "Cash" },
    filled: {
      acquisitionCaseId: "acq-1", date: today, amount: "380000", method: "NEFT/RTGS",
      reference: "NEFT-881231", notes: "Advance", documentFileId: ""
    },
    required: ["acquisitionCaseId", "date", "amount", "method"]
  },
  {
    name: "price change",
    schema: S.priceChangeInputSchema,
    minimal: { vehicleId: "veh-1", kind: "Asking", amount: "499000", reason: "Initial listing", date: today },
    filled: { vehicleId: "veh-1", kind: "Current asking", amount: "489000", reason: "Market feedback", date: today },
    required: ["vehicleId", "kind", "amount", "reason", "date"]
  },
  {
    name: "service request",
    schema: S.serviceRequestInputSchema,
    minimal: { saleId: "sale-1", complaint: "AC not cooling", reportedDate: today },
    filled: {
      saleId: "sale-1", complaint: "AC not cooling after a week", reportedDate: today,
      odometerKm: "42620", priority: "Normal", appointmentAt: "", notes: ""
    },
    required: ["saleId", "complaint", "reportedDate"]
  },
  {
    name: "service job",
    schema: S.serviceJobInputSchema,
    minimal: { serviceRequestId: "sr-1", date: today, workDone: "AC gas top-up" },
    filled: {
      serviceRequestId: "sr-1", date: today, odometerKm: "42620", workDone: "AC gas top-up",
      diagnosis: "Loose valve", parts: "800", labour: "700", vendorId: "", staffId: ""
    },
    required: ["serviceRequestId", "date", "workDone"]
  },
  {
    name: "service charge",
    schema: S.serviceChargeInputSchema,
    minimal: { serviceRequestId: "sr-1", date: today, amount: "5000", method: "UPI" },
    filled: {
      serviceRequestId: "sr-1", date: today, kind: "Charge", amount: "5000",
      method: "UPI", reference: "", notes: ""
    },
    required: ["serviceRequestId", "date", "amount", "method"]
  },
  {
    name: "commitment",
    schema: S.commitmentInputSchema,
    minimal: { saleId: "sale-1", kind: "Free service", coverage: "1 free service", startDate: today },
    filled: {
      saleId: "sale-1", kind: "Free service", coverage: "1 free service within 30 days",
      exclusions: "Consumables", startDate: today, endDate: today, odometerLimit: "1000",
      eligibleServices: "1", approvalNotes: ""
    },
    required: ["saleId", "kind", "coverage", "startDate"]
  },
  {
    name: "settings",
    schema: S.settingsInputSchema,
    minimal: { showroomName: "Royal Cars" },
    filled: {
      showroomName: "Royal Cars", tagline: "Trusted pre-owned cars", phone: "+91 80 4000 4000",
      whatsapp: "", email: "hello@royalcars.in", address: "Bengaluru", googleMapsLink: "",
      logoFileId: "", currency: "INR", timezone: "Asia/Kolkata", odometerUnit: "km",
      defaultDeliveryChecklist: "", defaultExpenseCategories: "", serviceDefaults: "",
      publicContactNote: ""
    },
    required: ["showroomName"]
  }
];

/**
 * What an untouched HTML form posts: every scalar key present and "".
 *
 * Arrays and objects are excluded: a checklist or line-item collection is built
 * by the UI and posted as a real array, never as an empty string.
 */
function blankForm(filled: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filled)
      .filter(([, v]) => typeof v !== "object" || v === null)
      .map(([k]) => [k, ""])
  );
}

describe.each(CASES)("$name form payload", (c) => {
  it("accepts the minimal payload", () => {
    const r = c.schema.safeParse(c.minimal);
    if (!r.success) throw new Error(`minimal payload rejected: ${r.error.issues[0]?.message}`);
    expect(r.success).toBe(true);
  });

  it("accepts a fully filled payload", () => {
    const r = c.schema.safeParse(c.filled);
    if (!r.success) throw new Error(`filled payload rejected: ${JSON.stringify(r.error.issues[0])}`);
    expect(r.success).toBe(true);
  });

  it('tolerates "" for every field that is not structurally required', () => {
    // Start from a blank form, then restore only the required fields.
    const payload = { ...blankForm(c.filled), ...c.minimal };
    const r = c.schema.safeParse(payload);
    if (!r.success) {
      throw new Error(
        `a blank form was rejected on "${r.error.issues[0]?.path.join(".")}": ${r.error.issues[0]?.message}`
      );
    }
    expect(r.success).toBe(true);
  });

  it('treats "" and an omitted key identically', () => {
    const omitted = c.schema.safeParse(c.minimal);
    const blanked = c.schema.safeParse({ ...blankForm(c.filled), ...c.minimal });
    expect(omitted.success).toBe(true);
    expect(blanked.success).toBe(true);
    if (omitted.success && blanked.success) {
      expect(blanked.data).toEqual(omitted.data);
    }
  });

  it("still refuses to drop a structurally required field", () => {
    for (const key of c.required) {
      const withoutIt = { ...c.minimal } as Record<string, unknown>;
      delete withoutIt[key];
      const omitted = c.schema.safeParse(withoutIt);
      expect(omitted.success, `omitting "${key}" should fail for ${c.name}`).toBe(false);

      const blanked = c.schema.safeParse({ ...c.minimal, [key]: "" });
      expect(blanked.success, `blanking "${key}" should fail for ${c.name}`).toBe(false);
    }
  });
});

/**
 * Round-trip: a blank-heavy payload must not only parse, it must reach the
 * store as the right thing. The failure this guards against is a schema default
 * quietly turning "not recorded" into a confident zero.
 */
import { beforeEach } from "vitest";
import { DemoStore } from "@/lib/store/demo-store";
import { setStoreForTests } from "@/lib/store";
import { Repo } from "@/lib/repo";
import type { DataStore, WriteContext } from "@/lib/store/types";
import { createEnquiry, markAcquired } from "@/server/services/acquisitions";
import { createWorkOrder, addExpense, addAccessory } from "@/server/services/work";
import { saveSettings } from "@/server/services/settings";

let store: DataStore;
let ctx: WriteContext;

beforeEach(async () => {
  store = new DemoStore();
  setStoreForTests(store);
  ctx = { actor: "owner@test" };
});

describe("blank payloads round-trip to the store", () => {
  it("stores unknown vehicle numbers as blank, never as zero", async () => {
    const payload = {
      sellerName: "Paper Record", sellerPhone: "", sellerAltPhone: "", sellerEmail: "",
      sellerAddress: "", leadSource: "", make: "Maruti", model: "", variant: "",
      manufactureYear: "", registrationYear: "", fuel: "", transmission: "", bodyType: "",
      colour: "", odometerKm: "", ownershipCount: "", registrationNumber: "", vin: "",
      engineNumber: "", registrationLocation: "", expectedPrice: "",
      inspectionAppointmentAt: "", followUpDate: "", negotiationNotes: ""
    };
    const enq = await createEnquiry(S.enquiryInputSchema.parse(payload), ctx);
    const v = await new Repo(store).table("Vehicles").get(enq.vehicle.id);

    // "Not recorded" must not read as a fact.
    expect(v?.odometerKm).toBe("");
    expect(v?.manufactureYear).toBe("");
    expect(v?.ownershipCount).toBe("");
    expect(v?.registrationNumber).toBe("");
    // Blank selects fall back to their documented default.
    expect(v?.fuel).toBe("Petrol");
    expect(v?.transmission).toBe("Manual");
  });

  it("applies work-order defaults when the form posts blanks", async () => {
    const enq = await createEnquiry(
      S.enquiryInputSchema.parse({ sellerName: "S", make: "Honda", model: "Jazz" }),
      ctx
    );
    await markAcquired(enq.caseRow.id, 30_000_00, "2026-09-22", ctx);

    const wo = await createWorkOrder(
      S.workOrderInputSchema.parse({
        vehicleId: enq.vehicle.id, stage: "Inventory preparation",
        issue: "", requiredWork: "", category: "", vendorId: "", assignedTo: "",
        estimated: "", startDate: "", expectedCompletionDate: "", odometerKm: "",
        payer: "", linkedWorkOrderRef: "", acquisitionCaseId: "", saleId: ""
      }),
      ctx
    );
    const row = await new Repo(store).table("WorkOrders").get(wo.id);
    expect(row?.category).toBe("General");
    expect(row?.payer).toBe("Showroom");
    expect(row?.estimatedPaise).toBe("0");
    expect(row?.status).toBe("Draft");
  });

  it("never wipes currency, timezone or the expense category list", async () => {
    // The settings form posts every field; the user only edited the name.
    await saveSettings(
      S.settingsInputSchema.parse({
        showroomName: "Royal Cars", tagline: "", phone: "", whatsapp: "", email: "",
        address: "", googleMapsLink: "", logoFileId: "", currency: "", timezone: "",
        odometerUnit: "", defaultDeliveryChecklist: "", defaultExpenseCategories: "",
        serviceDefaults: "", publicContactNote: ""
      }),
      ctx
    );
    const settings = await new Repo(store).settings();
    expect(settings["showroom:currency"]).toBe("INR");
    expect(settings["showroom:timezone"]).toBe("Asia/Kolkata");
    expect(settings["showroom:odometerUnit"]).toBe("km");
    expect(settings["showroom:defaultExpenseCategories"]).toContain("Transportation");
  });

  it("keeps money rules intact when optional amounts are blank", async () => {
    const enq = await createEnquiry(
      S.enquiryInputSchema.parse({ sellerName: "S", make: "Tata", model: "Tiago" }),
      ctx
    );
    await markAcquired(enq.caseRow.id, 30_000_00, "2026-09-22", ctx);

    // A quantity-less accessory defaults to one, and still costs what it costs.
    const acc = await addAccessory(
      S.accessoryInputSchema.parse({
        vehicleId: enq.vehicle.id, item: "Dashcam", quantity: "", unitCost: "6500",
        vendorId: "", installedOn: "", required: "", workOrderId: "", payer: "", notes: ""
      }),
      ctx
    );
    const row = await new Repo(store).table("Accessories").get(acc.id);
    expect(row?.quantity).toBe("1");
    expect(row?.totalPaise).toBe("650000");
    expect(row?.payer).toBe("Showroom");

    // A customer-paid expense with blanks elsewhere is still not a showroom cost.
    await addExpense(
      S.expenseInputSchema.parse({
        vehicleId: enq.vehicle.id, category: "Insurance", date: "2026-09-22",
        amount: "9000", payer: "Customer", saleId: "", serviceJobId: "",
        vendorId: "", reference: "", notes: ""
      }),
      ctx
    );
    const { investmentBreakdown } = await import("@/server/services/work");
    const inv = await investmentBreakdown(store, enq.vehicle.id);
    expect(inv.other).toBe(0);
    expect(inv.accessories).toBe(650000);
  });
});
