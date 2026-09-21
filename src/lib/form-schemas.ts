import { z } from "zod";
import {
  CHECKLIST_AREAS, CONDITIONS, dateOnly, EXPENSE_CATEGORIES, HISTORY_STATES,
  INSPECTION_RESULTS, INSPECTION_TYPES, LEAD_SOURCES, LEAD_STATUSES, moneyInput,
  looseOptionalPhone, optionalDateOnly, optionalEmail, optionalMoneyInput,
  optionalText, optionalWholeNumber, PAYMENT_METHODS, PAYER_OPTIONS,
  SERVICE_PRIORITIES, WORK_STAGES
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
    leadSource: z.enum(LEAD_SOURCES).optional().default("Walk-in"),

    // Vehicle: everything optional. At least one identifying detail is required
    // below so the car is not completely anonymous.
    make: optionalText,
    model: optionalText,
    variant: optionalText,
    manufactureYear: optionalWholeNumber(1900, YEAR_MAX, "Manufacture year"),
    registrationYear: optionalWholeNumber(1900, YEAR_MAX, "Registration year"),
    fuel: z.enum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid"]).optional().default("Petrol"),
    transmission: z.enum(["Manual", "Automatic"]).optional().default("Manual"),
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
  finding: z.string().optional().default(""),
  estimatedCost: moneyInput.optional(),
  createWorkOrder: z.boolean().optional().default(false),
  workCategory: z.string().optional().default("")
});

export const inspectionInputSchema = z.object({
  vehicleId: z.string().min(1),
  acquisitionCaseId: z.string().optional().default(""),
  type: z.enum(INSPECTION_TYPES),
  date: dateOnly,
  odometerKm: optionalWholeNumber(0, 1_000_000, "Odometer"),
  overallResult: z.enum(INSPECTION_RESULTS),
  estimatedRepair: moneyInput.optional(),
  recommendedWork: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  accidentHistory: z.enum(HISTORY_STATES).default("Unknown"),
  floodHistory: z.enum(HISTORY_STATES).default("Unknown"),
  items: z.array(checklistItemSchema).default([])
});
export type InspectionInput = ServiceInput<typeof inspectionInputSchema>;

/** Work orders */
export const workOrderInputSchema = z.object({
  vehicleId: z.string().min(1),
  acquisitionCaseId: z.string().optional().default(""),
  saleId: z.string().optional().default(""),
  stage: z.enum(WORK_STAGES),
  issue: optionalText,
  requiredWork: z.string().optional().default(""),
  category: z.string().optional().default("General"),
  vendorId: z.string().optional().default(""),
  assignedTo: z.string().optional().default(""),
  estimated: moneyInput.optional(),
  startDate: optionalDateOnly,
  expectedCompletionDate: optionalDateOnly,
  odometerKm: z.coerce.number().int().min(0).optional(),
  payer: z.enum(PAYER_OPTIONS).default("Showroom"),
  linkedWorkOrderRef: z.string().optional().default("")
});
export type WorkOrderInput = ServiceInput<typeof workOrderInputSchema>;

export const workCompletionSchema = z.object({
  parts: optionalMoneyInput,
  labour: optionalMoneyInput,
  other: optionalMoneyInput,
  tax: optionalMoneyInput,
  discount: optionalMoneyInput,
  invoiceNumber: z.string().optional().default(""),
  completionNotes: z.string().optional().default(""),
  completedOn: dateOnly
});
export type WorkCompletionInput = ServiceInput<typeof workCompletionSchema>;

/** Accessories & expenses */
export const accessoryInputSchema = z.object({
  vehicleId: z.string().min(1),
  item: optionalText,
  quantity: z.coerce.number().int().min(1).default(1),
  unitCost: moneyInput,
  vendorId: z.string().optional().default(""),
  installedOn: optionalDateOnly,
  required: z.boolean().default(false),
  workOrderId: z.string().optional().default(""),
  payer: z.enum(PAYER_OPTIONS).default("Showroom"),
  notes: z.string().optional().default("")
});
export type AccessoryInput = ServiceInput<typeof accessoryInputSchema>;

export const expenseInputSchema = z.object({
  vehicleId: z.string().min(1),
  saleId: z.string().optional().default(""),
  serviceJobId: z.string().optional().default(""),
  category: z.enum(EXPENSE_CATEGORIES),
  date: dateOnly,
  amount: moneyInput,
  payer: z.enum(PAYER_OPTIONS).default("Showroom"),
  vendorId: z.string().optional().default(""),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type ExpenseInput = ServiceInput<typeof expenseInputSchema>;

/** CRM */
export const customerInputSchema = z.object({
  name: optionalText,
  phone: looseOptionalPhone,
  altPhone: looseOptionalPhone,
  email: optionalEmail,
  address: z.string().optional().default(""),
  idType: z.string().optional().default(""),
  idNumberMasked: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type CustomerInput = ServiceInput<typeof customerInputSchema>;

export const leadInputSchema = z.object({
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: z.string().optional().default(""),
  source: z.enum(LEAD_SOURCES),
  budget: moneyInput.optional(),
  status: z.enum(LEAD_STATUSES).default("New"),
  assignedTo: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type LeadInput = ServiceInput<typeof leadInputSchema>;

export const followUpInputSchema = z.object({
  leadId: z.string().optional().default(""),
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: z.string().optional().default(""),
  dueDate: dateOnly,
  note: optionalText,
  status: z.enum(["Open", "Done", "Cancelled"]).default("Open")
});
export type FollowUpInput = ServiceInput<typeof followUpInputSchema>;

export const testDriveInputSchema = z.object({
  leadId: z.string().optional().default(""),
  customerId: z.string().min(1, "Choose the customer"),
  vehicleId: z.string().min(1, "Choose the vehicle"),
  scheduledAt: z.string().min(5, "Pick a date and time"),
  staffId: z.string().optional().default(""),
  notes: z.string().optional().default("")
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
  terms: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type ReservationInput = ServiceInput<typeof reservationInputSchema>;

export const saleInputSchema = z.object({
  vehicleId: z.string().min(1),
  customerName: optionalText,
  customerPhone: looseOptionalPhone,
  reservationId: z.string().optional().default(""),
  finalNetPrice: moneyInput,
  saleDate: dateOnly,
  paymentTerms: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type SaleInput = ServiceInput<typeof saleInputSchema>;

export const salePaymentInputSchema = z.object({
  saleId: z.string().min(1),
  date: dateOnly,
  kind: z.enum(["Part payment", "Final payment"]).default("Part payment"),
  amount: moneyInput,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  idempotencyKey: z.string().optional().default("")
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
  reference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  documentFileId: z.string().optional().default("")
});
export type PurchasePaymentInput = ServiceInput<typeof purchasePaymentInputSchema>;

/** Delivery */
export const completeDeliveryInputSchema = z.object({
  saleId: z.string().min(1),
  deliveryDate: dateOnly,
  odometerKm: z.coerce.number().int().min(0),
  items: z.array(z.object({
    kind: z.string(),
    label: z.string(),
    mandatory: z.boolean(),
    done: z.boolean(),
    note: z.string().optional().default("")
  })),
  instructions: z.string().optional().default(""),
  allowOutstandingBalance: z.boolean().optional().default(false),
  exceptionReason: z.string().optional().default("")
});
export type CompleteDeliveryInput = ServiceInput<typeof completeDeliveryInputSchema>;

/** After-sale */
export const commitmentInputSchema = z.object({
  saleId: z.string().min(1),
  kind: z.enum(["Free service", "Promised repair", "Extended coverage"]),
  coverage: z.string().min(3, "Describe the coverage"),
  exclusions: z.string().optional().default(""),
  startDate: dateOnly,
  endDate: optionalDateOnly,
  odometerLimit: z.coerce.number().int().min(0).optional(),
  eligibleServices: z.coerce.number().int().min(0).optional(),
  approvalNotes: z.string().optional().default("")
});
export type CommitmentInput = ServiceInput<typeof commitmentInputSchema>;

export const serviceRequestInputSchema = z.object({
  saleId: z.string().min(1, "Choose the sale"),
  complaint: z.string().min(5, "Describe the complaint"),
  reportedDate: dateOnly,
  odometerKm: z.coerce.number().int().min(0).optional(),
  priority: z.enum(SERVICE_PRIORITIES).default("Normal"),
  appointmentAt: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type ServiceRequestInput = ServiceInput<typeof serviceRequestInputSchema>;

export const serviceJobInputSchema = z.object({
  serviceRequestId: z.string().min(1),
  date: dateOnly,
  odometerKm: z.coerce.number().int().min(0).optional(),
  workDone: z.string().min(3, "Describe the work done"),
  diagnosis: z.string().optional().default(""),
  parts: moneyInput.optional(),
  labour: moneyInput.optional(),
  vendorId: z.string().optional().default(""),
  staffId: z.string().optional().default("")
});
export type ServiceJobInput = ServiceInput<typeof serviceJobInputSchema>;

export const serviceChargeInputSchema = z.object({
  serviceRequestId: z.string().min(1),
  date: dateOnly,
  kind: z.enum(["Charge", "Refund", "Adjustment"]).default("Charge"),
  amount: moneyInput,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default("")
});
export type ServiceChargeInput = ServiceInput<typeof serviceChargeInputSchema>;

/** Settings */
export const settingsInputSchema = z.object({
  showroomName: z.string().min(2, "Enter the showroom name"),
  tagline: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  email: optionalEmail,
  address: z.string().optional().default(""),
  googleMapsLink: z.string().optional().default(""),
  logoFileId: z.string().optional().default(""),
  currency: z.string().default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
  odometerUnit: z.string().default("km"),
  defaultDeliveryChecklist: z.string().optional().default(""),
  defaultExpenseCategories: z
    .string()
    .optional()
    .default("Transportation, Insurance, Documentation, Parking, Advertising, Inspection fee, Miscellaneous"),
  serviceDefaults: z.string().optional().default(""),
  publicContactNote: z.string().optional().default("")
});
export type SettingsInput = ServiceInput<typeof settingsInputSchema>;

export const staffInputSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(2, "Enter the staff name"),
  role: z.enum(["owner", "sales", "operations", "accounts"]),
  phone: z.string().optional().default(""),
  active: z.boolean().default(true)
});
export type StaffInput = ServiceInput<typeof staffInputSchema>;
