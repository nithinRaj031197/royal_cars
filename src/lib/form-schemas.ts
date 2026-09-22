import { z } from "zod";
import {
  CHECKLIST_AREAS, CONDITIONS, dateOnly, EXPENSE_CATEGORIES, HISTORY_STATES,
  INSPECTION_RESULTS, INSPECTION_TYPES, LEAD_SOURCES, LEAD_STATUSES, moneyInput,
  defaultedText, looseOptionalPhone, optionalCount, optionalDateOnly, optionalEmail,
  optionalEnum, optionalMoney, optionalMoneyInput, optionalText, optionalWholeNumber,
  PAYMENT_METHODS, PAYER_OPTIONS, SERVICE_PRIORITIES, WORK_STAGES
} from "./schema";

const YEAR_MAX = new Date().getFullYear() + 1;

/**
 * Single source of truth for every admin input schema.
 *
 * Both the client forms (via zodResolver) and the API routes (via parseBody)
 * use these exact objects, so validation cannot drift between the two.
 * Services import and re-export from here rather than redefining.
 */

type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/**
 * The shape a service accepts: the schema's OUTPUT (money already in paise,
 * numbers coerced) but with defaulted/optional keys left optional, so server
 * code and tests can omit them. Routes pass a fully parsed object, which
 * satisfies this too.
 */
export type ServiceInput<S extends z.ZodTypeAny> =
  Omit<z.output<S>, Extract<OptionalKeys<z.input<S>>, keyof z.output<S>>> &
  Partial<Pick<z.output<S>, Extract<OptionalKeys<z.input<S>>, keyof z.output<S>>>>;

/** Seller enquiry / acquisition case */
export const enquiryInputSchema = z
  .object({
    // Seller: whatever is known. At least one of name or phone is required
    // below, so the record can still be found.
    sellerName: optionalText,
    sellerPhone: looseOptionalPhone,
    sellerAltPhone: looseOptionalPhone,
    sellerEmail: optionalEmail,
    sellerAddress: optionalText,
    leadSource: optionalEnum(LEAD_SOURCES, "Walk-in"),

    // Vehicle: everything optional. At least one identifying detail is required
    // below so the car is not completely anonymous.
    make: optionalText,
    model: optionalText,
    variant: optionalText,
    manufactureYear: optionalWholeNumber(1900, YEAR_MAX, "Manufacture year"),
    registrationYear: optionalWholeNumber(1900, YEAR_MAX, "Registration year"),
    fuel: optionalEnum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid"], "Petrol"),
    transmission: optionalEnum(["Manual", "Automatic"], "Manual"),
    bodyType: optionalText,
    colour: optionalText,
    odometerKm: optionalWholeNumber(0, 1_000_000, "Odometer"),
    ownershipCount: optionalWholeNumber(0, 20, "Owners"),
    registrationNumber: optionalText,
    vin: optionalText,
    engineNumber: optionalText,
    registrationLocation: optionalText,

    expectedPrice: optionalMoneyInput,
    inspectionAppointmentAt: optionalText,
    followUpDate: optionalDateOnly,
    negotiationNotes: optionalText
  })
  .superRefine((v, ctx) => {
    // Two minimums, so a saved record is still findable and still a car.
    if (!v.sellerName && !v.sellerPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sellerName"],
        message: "Enter at least the seller's name or phone number"
      });
    }
    if (!v.registrationNumber && !v.make && !v.model) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationNumber"],
        message: "Enter at least a registration number, make or model"
      });
    }
  });

export type EnquiryInput = ServiceInput<typeof enquiryInputSchema>;

/** Inspections */
export const checklistItemSchema = z.object({
  area: z.enum(CHECKLIST_AREAS),
  condition: z.enum(CONDITIONS),
  finding: optionalText,
  estimatedCost: optionalMoney,
  createWorkOrder: z.preprocess((v) => (v === "" ? undefined : v), z.boolean().optional().default(false)),
  workCategory: optionalText
});

export const inspectionInputSchema = z.object({
  vehicleId: z.string().min(1),
  acquisitionCaseId: optionalText,
  type: z.enum(INSPECTION_TYPES),
  date: dateOnly,
  odometerKm: optionalWholeNumber(0, 1_000_000, "Odometer"),
  overallResult: z.enum(INSPECTION_RESULTS),
  estimatedRepair: optionalMoney,
  recommendedWork: optionalText,
  notes: optionalText,
  accidentHistory: optionalEnum(HISTORY_STATES, "Unknown"),
  floodHistory: optionalEnum(HISTORY_STATES, "Unknown"),
  items: z.array(checklistItemSchema).default([])
});
export type InspectionInput = ServiceInput<typeof inspectionInputSchema>;

/** Work orders */
export const workOrderInputSchema = z.object({
  vehicleId: z.string().min(1),
  acquisitionCaseId: optionalText,
  saleId: optionalText,
  stage: z.enum(WORK_STAGES),
  issue: optionalText,
  requiredWork: optionalText,
  category: defaultedText("General"),
  vendorId: optionalText,
  assignedTo: optionalText,
  estimated: optionalMoney,
  startDate: optionalDateOnly,
  expectedCompletionDate: optionalDateOnly,
  odometerKm: optionalCount(0, 1_000_000, "Value"),
  payer: optionalEnum(PAYER_OPTIONS, "Showroom"),
  linkedWorkOrderRef: optionalText
});
export type WorkOrderInput = ServiceInput<typeof workOrderInputSchema>;

export const workCompletionSchema = z.object({
  parts: optionalMoneyInput,
  labour: optionalMoneyInput,
  other: optionalMoneyInput,
  tax: optionalMoneyInput,
  discount: optionalMoneyInput,
  invoiceNumber: optionalText,
  completionNotes: optionalText,
  completedOn: dateOnly
});
export type WorkCompletionInput = ServiceInput<typeof workCompletionSchema>;

/** Accessories & expenses */
export const accessoryInputSchema = z.object({
  vehicleId: z.string().min(1),
  item: optionalText,
  quantity: optionalCount(1, 9999, "Quantity", 1),
  unitCost: moneyInput,
  vendorId: optionalText,
  installedOn: optionalDateOnly,
  required: z.preprocess((v) => (v === "" ? undefined : v), z.boolean().optional().default(false)),
  workOrderId: optionalText,
  payer: optionalEnum(PAYER_OPTIONS, "Showroom"),
  notes: optionalText
});
export type AccessoryInput = ServiceInput<typeof accessoryInputSchema>;

export const expenseInputSchema = z.object({
  vehicleId: z.string().min(1),
  saleId: optionalText,
  serviceJobId: optionalText,
  category: z.enum(EXPENSE_CATEGORIES),
  date: dateOnly,
  amount: moneyInput,
  payer: optionalEnum(PAYER_OPTIONS, "Showroom"),
  vendorId: optionalText,
  reference: optionalText,
  notes: optionalText
});
export type ExpenseInput = ServiceInput<typeof expenseInputSchema>;

/** CRM */
export const customerInputSchema = z.object({
  name: optionalText,
  phone: looseOptionalPhone,
  altPhone: looseOptionalPhone,
  email: optionalEmail,
  address: optionalText,
  idType: optionalText,
  idNumberMasked: optionalText,
  notes: optionalText
});
export type CustomerInput = ServiceInput<typeof customerInputSchema>;

export const leadInputSchema = z.object({
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: optionalText,
  source: z.enum(LEAD_SOURCES),
  budget: optionalMoney,
  status: optionalEnum(LEAD_STATUSES, "New"),
  assignedTo: optionalText,
  notes: optionalText
});
export type LeadInput = ServiceInput<typeof leadInputSchema>;

export const followUpInputSchema = z.object({
  leadId: optionalText,
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: optionalText,
  dueDate: dateOnly,
  note: optionalText,
  status: optionalEnum(["Open", "Done", "Cancelled"], "Open")
});
export type FollowUpInput = ServiceInput<typeof followUpInputSchema>;

export const testDriveInputSchema = z.object({
  leadId: optionalText,
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: z.string().min(1, "Choose the vehicle"),
  scheduledAt: z.string().min(5, "Pick a date and time"),
  staffId: optionalText,
  notes: optionalText
});
export type TestDriveInput = ServiceInput<typeof testDriveInputSchema>;

/** Sales */
export const reservationInputSchema = z.object({
  vehicleId: z.string().min(1),
  customerName: optionalText,
  customerPhone: looseOptionalPhone,
  agreedPrice: moneyInput,
  bookingAmount: moneyInput,
  bookingDate: dateOnly,
  expiresOn: optionalDateOnly,
  terms: optionalText,
  notes: optionalText
});
export type ReservationInput = ServiceInput<typeof reservationInputSchema>;

export const saleInputSchema = z.object({
  vehicleId: z.string().min(1),
  customerName: optionalText,
  customerPhone: looseOptionalPhone,
  reservationId: optionalText,
  finalNetPrice: moneyInput,
  saleDate: dateOnly,
  paymentTerms: optionalText,
  notes: optionalText
});
export type SaleInput = ServiceInput<typeof saleInputSchema>;

export const salePaymentInputSchema = z.object({
  saleId: z.string().min(1),
  date: dateOnly,
  kind: optionalEnum(["Part payment", "Final payment"], "Part payment"),
  amount: moneyInput,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText
});
export type SalePaymentInput = ServiceInput<typeof salePaymentInputSchema>;

export const priceChangeInputSchema = z.object({
  vehicleId: z.string().min(1),
  kind: z.enum(["Asking", "Current asking", "Minimum"]),
  amount: moneyInput,
  reason: z.string().min(3, "Record a reason for the price change"),
  date: dateOnly
});
export type PriceChangeInput = ServiceInput<typeof priceChangeInputSchema>;

/** Purchases */
export const purchasePaymentInputSchema = z.object({
  acquisitionCaseId: z.string().min(1),
  date: dateOnly,
  amount: moneyInput,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText,
  notes: optionalText,
  documentFileId: optionalText
});
export type PurchasePaymentInput = ServiceInput<typeof purchasePaymentInputSchema>;

/** Delivery */
export const completeDeliveryInputSchema = z.object({
  saleId: z.string().min(1),
  deliveryDate: dateOnly,
  odometerKm: optionalCount(0, 1_000_000, "Value"),
  items: z.array(z.object({
    kind: z.string(),
    label: z.string(),
    mandatory: z.boolean(),
    done: z.boolean(),
    note: optionalText
  })),
  instructions: optionalText,
  allowOutstandingBalance: z.preprocess((v) => (v === "" ? undefined : v), z.boolean().optional().default(false)),
  exceptionReason: optionalText
});
export type CompleteDeliveryInput = ServiceInput<typeof completeDeliveryInputSchema>;

/** After-sale */
export const commitmentInputSchema = z.object({
  saleId: z.string().min(1),
  kind: z.enum(["Free service", "Promised repair", "Extended coverage"]),
  coverage: z.string().min(3, "Describe the coverage"),
  exclusions: optionalText,
  startDate: dateOnly,
  endDate: optionalDateOnly,
  odometerLimit: optionalCount(0, 1_000_000, "Value"),
  eligibleServices: optionalCount(0, 1_000_000, "Value"),
  approvalNotes: optionalText
});
export type CommitmentInput = ServiceInput<typeof commitmentInputSchema>;

export const serviceRequestInputSchema = z.object({
  saleId: z.string().min(1, "Choose the sale"),
  complaint: z.string().min(5, "Describe the complaint"),
  reportedDate: dateOnly,
  odometerKm: optionalCount(0, 1_000_000, "Value"),
  priority: optionalEnum(SERVICE_PRIORITIES, "Normal"),
  appointmentAt: optionalText,
  notes: optionalText
});
export type ServiceRequestInput = ServiceInput<typeof serviceRequestInputSchema>;

export const serviceJobInputSchema = z.object({
  serviceRequestId: z.string().min(1),
  date: dateOnly,
  odometerKm: optionalCount(0, 1_000_000, "Value"),
  workDone: z.string().min(3, "Describe the work done"),
  diagnosis: optionalText,
  parts: optionalMoney,
  labour: optionalMoney,
  vendorId: optionalText,
  staffId: optionalText
});
export type ServiceJobInput = ServiceInput<typeof serviceJobInputSchema>;

export const serviceChargeInputSchema = z.object({
  serviceRequestId: z.string().min(1),
  date: dateOnly,
  kind: optionalEnum(["Charge", "Refund", "Adjustment"], "Charge"),
  amount: moneyInput,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText,
  notes: optionalText
});
export type ServiceChargeInput = ServiceInput<typeof serviceChargeInputSchema>;

/** Settings */
export const settingsInputSchema = z.object({
  showroomName: z.string().min(2, "Enter the showroom name"),
  tagline: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  address: optionalText,
  googleMapsLink: optionalText,
  logoFileId: optionalText,
  currency: defaultedText("INR"),
  timezone: defaultedText("Asia/Kolkata"),
  odometerUnit: defaultedText("km"),
  defaultDeliveryChecklist: optionalText,
  defaultExpenseCategories: defaultedText(
      "Transportation, Insurance, Documentation, Parking, Advertising, Inspection fee, Miscellaneous"
    ),
  serviceDefaults: optionalText,
  publicContactNote: optionalText
});
export type SettingsInput = ServiceInput<typeof settingsInputSchema>;

export const staffInputSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(2, "Enter the staff name"),
  role: z.enum(["owner", "sales", "operations", "accounts"]),
  phone: optionalText,
  active: z.preprocess((v) => (v === "" ? undefined : v), z.boolean().optional().default(true))
});
export type StaffInput = ServiceInput<typeof staffInputSchema>;
