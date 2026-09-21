/**
 * Application-managed tab registry.
 *
 * Every tab has an explicit ordered column schema. The store layer validates
 * headers on first access and refuses to operate on unknown schemas (unless
 * running in demo mode where sheets are emulated in memory).
 *
 * Convention (first 8 columns, always in this order):
 *   id, createdAt, updatedAt, version, operationId, createdBy, updatedBy, archived
 * Subsequent columns are entity-specific.
 */

export interface TableDef {
  name: string;
  /** Ordered list of columns; the store validates exact match. */
  columns: string[];
}

const BASE = ["id", "createdAt", "updatedAt", "version", "operationId", "createdBy", "updatedBy", "archived"] as const;

function cols(...rest: string[]): string[] {
  return [...BASE, ...rest];
}

export const TABLES = {
  Staff: {
    name: "Staff",
    // passwordHash is a scrypt hash, never a password. See server/auth/password.ts.
    columns: cols(
      "email",
      "name",
      "role",
      "active",
      "phone",
      "googleSub",
      "lastLoginAt",
      "passwordHash",
      "passwordSetAt",
      "mustChangePassword",
      "failedAttempts",
      "lockedUntil"
    )
  },
  Sellers: {
    name: "Sellers",
    columns: cols("name", "phone", "altPhone", "email", "address", "leadSource", "notes")
  },
  Vehicles: {
    name: "Vehicles",
    columns: cols(
      "stockRef",
      "registrationNumber",
      "vin",
      "engineNumber",
      "make",
      "model",
      "variant",
      "manufactureYear",
      "registrationYear",
      "fuel",
      "transmission",
      "bodyType",
      "colour",
      "ownershipCount",
      "odometerKm",
      "registrationLocation",
      "showroomLocation",
      "sellerId",
      "acquisitionCaseId",
      "purchaseDate",
      "purchasePricePaise",
      "receivingDate",
      "lifecycleState",
      "publicationState",
      "acquisitionNotes",
      "askingPricePaise",
      "currentAskingPaise",
      "minimumPricePaise",
      "finalSalePricePaise",
      "publicSlug",
      "publicTitle",
      "publicDescription",
      "publicFeatures",
      "seoTitle",
      "seoDescription",
      "publishedAt"
    )
  },
  AcquisitionCases: {
    name: "AcquisitionCases",
    columns: cols(
      "caseRef",
      "vehicleId",
      "sellerId",
      "status",
      "leadSource",
      "expectedPricePaise",
      "offeredPricePaise",
      "agreedPricePaise",
      "assignedTo",
      "followUpDate",
      "negotiationNotes",
      "inspectionAppointmentAt",
      "closeReason",
      "closedAt"
    )
  },
  PurchasePayments: {
    name: "PurchasePayments",
    columns: cols(
      "paymentRef",
      "acquisitionCaseId",
      "vehicleId",
      "sellerId",
      "date",
      "amountPaise",
      "method",
      "reference",
      "notes",
      "documentFileId",
      "recordedBy"
    )
  },
  Inspections: {
    name: "Inspections",
    columns: cols(
      "inspectionRef",
      "vehicleId",
      "acquisitionCaseId",
      "type",
      "inspectedBy",
      "date",
      "odometerKm",
      "overallResult",
      "estimatedRepairPaise",
      "recommendedWork",
      "notes",
      "accidentHistory",
      "floodHistory"
    )
  },
  InspectionItems: {
    name: "InspectionItems",
    columns: cols(
      "inspectionId",
      "area",
      "condition",
      "finding",
      "workOrderRef",
      "estimatedCostPaise"
    )
  },
  Vendors: {
    name: "Vendors",
    columns: cols("name", "category", "phone", "email", "address", "gst", "notes", "preferred")
  },
  WorkOrders: {
    name: "WorkOrders",
    columns: cols(
      "workOrderRef",
      "vehicleId",
      "acquisitionCaseId",
      "saleId",
      "stage",
      "issue",
      "requiredWork",
      "category",
      "vendorId",
      "assignedTo",
      "estimatedPaise",
      "actualPaise",
      "partsPaise",
      "labourPaise",
      "otherPaise",
      "taxPaise",
      "discountPaise",
      "startDate",
      "expectedCompletionDate",
      "completedOn",
      "odometerKm",
      "status",
      "payer",
      "approvedBy",
      "approvalNotes",
      "completionNotes",
      "invoiceNumber",
      "invoiceAmountPaise",
      "invoiceDocumentId",
      "linkedWorkOrderRef"
    )
  },
  WorkOrderItems: {
    name: "WorkOrderItems",
    columns: cols(
      "workOrderId",
      "description",
      "kind",
      "quantity",
      "unitCostPaise",
      "totalPaise"
    )
  },
  Accessories: {
    name: "Accessories",
    columns: cols(
      "vehicleId",
      "acquisitionCaseId",
      "item",
      "quantity",
      "unitCostPaise",
      "totalPaise",
      "vendorId",
      "installedOn",
      "required",
      "workOrderId",
      "documentFileId",
      "notes",
      "payer"
    )
  },
  Expenses: {
    name: "Expenses",
    columns: cols(
      "expenseRef",
      "vehicleId",
      "acquisitionCaseId",
      "saleId",
      "serviceJobId",
      "category",
      "date",
      "amountPaise",
      "payer",
      "vendorId",
      "reference",
      "notes",
      "documentFileId",
      "recordedBy"
    )
  },
  VehiclePhotos: {
    name: "VehiclePhotos",
    columns: cols(
      "vehicleId",
      "fileId",
      "url",
      "category",
      "isPrimary",
      "sortOrder",
      "inspectionId",
      "uploadedBy",
      "mimeType",
      "sizeBytes",
      "width",
      "height",
      "publicApproved"
    )
  },
  VehicleDocuments: {
    name: "VehicleDocuments",
    columns: cols(
      "vehicleId",
      "acquisitionCaseId",
      "saleId",
      "serviceJobId",
      "type",
      "title",
      "fileId",
      "mimeType",
      "sizeBytes",
      "uploadedBy",
      "issueDate",
      "expiryDate",
      "notes",
      "sensitive"
    )
  },
  PriceHistory: {
    name: "PriceHistory",
    columns: cols(
      "vehicleId",
      "date",
      "kind",
      "amountPaise",
      "previousPaise",
      "reason",
      "setBy"
    )
  },
  Customers: {
    name: "Customers",
    columns: cols("name", "phone", "altPhone", "email", "address", "idType", "idNumberMasked", "dob", "anniversary", "notes")
  },
  Leads: {
    name: "Leads",
    columns: cols(
      "leadRef",
      "customerId",
      "vehicleId",
      "source",
      "budgetPaise",
      "status",
      "assignedTo",
      "notes"
    )
  },
  FollowUps: {
    name: "FollowUps",
    columns: cols("leadId", "customerId", "vehicleId", "dueDate", "note", "status", "outcome", "completedAt")
  },
  TestDrives: {
    name: "TestDrives",
    columns: cols(
      "driveRef",
      "leadId",
      "customerId",
      "vehicleId",
      "scheduledAt",
      "status",
      "outcome",
      "feedback",
      "staffId",
      "odometerBefore",
      "odometerAfter"
    )
  },
  Reservations: {
    name: "Reservations",
    columns: cols(
      "reservationRef",
      "vehicleId",
      "customerId",
      "agreedPricePaise",
      "bookingAmountPaise",
      "bookingDate",
      "expiresOn",
      "terms",
      "notes",
      "status",
      "cancelledReason",
      "refundAmountPaise",
      "refundMethod",
      "refundDate",
      "convertedSaleId"
    )
  },
  Sales: {
    name: "Sales",
    columns: cols(
      "saleRef",
      "vehicleId",
      "customerId",
      "salespersonId",
      "reservationId",
      "finalNetPricePaise",
      "saleDate",
      "paymentTerms",
      "deliveryDate",
      "status",
      "deliveryChecklistId",
      "docsComplete",
      "notes",
      "cancelReason",
      // Snapshot fields captured at sale completion (see spec §11):
      "snapshotInvestmentPaise",
      "snapshotPurchasePaise",
      "snapshotRepairsPaise",
      "snapshotAccessoriesPaise",
      "snapshotOtherPaise",
      "snapshotGrossProfitPaise",
      "snapshotAt"
    )
  },
  SalePayments: {
    name: "SalePayments",
    columns: cols(
      "paymentRef",
      "saleId",
      "reservationId",
      "vehicleId",
      "customerId",
      "date",
      "kind",
      "amountPaise",
      "method",
      "reference",
      "notes",
      "recordedBy",
      "voidedAt",
      "voidReason",
      "voidedBy",
      "reversesPaymentId"
    )
  },
  DeliveryChecklists: {
    name: "DeliveryChecklists",
    columns: cols(
      "checklistRef",
      "saleId",
      "vehicleId",
      "deliveryDate",
      "odometerKm",
      "itemsJson",
      "allMandatoryDone",
      "balanceOutstandingPaise",
      "exceptionApprovedBy",
      "exceptionReason",
      "acknowledgedBy",
      "acknowledgedAt",
      "instructions",
      "status"
    )
  },
  ServiceCommitments: {
    name: "ServiceCommitments",
    columns: cols(
      "commitmentRef",
      "saleId",
      "vehicleId",
      "customerId",
      "kind",
      "coverage",
      "exclusions",
      "startDate",
      "endDate",
      "odometerLimit",
      "eligibleServices",
      "servicesUsed",
      "agreementDocumentId",
      "approvalNotes",
      "status"
    )
  },
  ServiceRequests: {
    name: "ServiceRequests",
    columns: cols(
      "requestRef",
      "saleId",
      "vehicleId",
      "customerId",
      "complaint",
      "reportedDate",
      "odometerKm",
      "priority",
      "appointmentAt",
      "coverageDecision",
      "coverageReason",
      "assignedTo",
      "vendorId",
      "diagnosis",
      "workOrderId",
      "partsPaise",
      "labourPaise",
      "actualCostPaise",
      "payer",
      "customerChargePaise",
      "completionNotes",
      "customerAcknowledged",
      "nextFollowUpDate",
      "status",
      "cancelledReason",
      "reopenedFromId"
    )
  },
  ServiceJobs: {
    name: "ServiceJobs",
    columns: cols(
      "jobRef",
      "serviceRequestId",
      "vehicleId",
      "date",
      "odometerKm",
      "workDone",
      "partsPaise",
      "labourPaise",
      "totalPaise",
      "vendorId",
      "staffId",
      "chargesPaymentId",
      "status"
    )
  },
  ServiceCharges: {
    name: "ServiceCharges",
    columns: cols(
      "chargeRef",
      "serviceRequestId",
      "vehicleId",
      "customerId",
      "date",
      "kind",
      "amountPaise",
      "method",
      "reference",
      "notes",
      "recordedBy",
      "voidedAt",
      "voidReason",
      "voidedBy",
      "reversesChargeId"
    )
  },
  StatusHistory: {
    name: "StatusHistory",
    columns: cols(
      "entityType",
      "entityId",
      "fromState",
      "toState",
      "reason",
      "at",
      "by"
    )
  },
  ActivityLogs: {
    name: "ActivityLogs",
    columns: cols("actorId", "actorEmail", "action", "entityType", "entityId", "summary", "detailsJson")
  },
  Settings: {
    name: "Settings",
    columns: cols("value", "description")
  },
  ImportBatches: {
    name: "ImportBatches",
    columns: cols(
      "batchRef",
      "entityType",
      "fileName",
      "mode",
      "totalRows",
      "createdCount",
      "updatedCount",
      "errorCount",
      "errorsJson",
      "importedBy",
      "operationId"
    )
  },
  Operations: {
    name: "Operations",
    columns: cols(
      "kind",
      "entityType",
      "entityId",
      "requestId",
      "status",
      "attempts",
      "lastError",
      "payloadJson",
      "completedAt"
    )
  }
} satisfies Record<string, TableDef>;

/**
 * Every application tab, as a literal union.
 *
 * Because TABLES is declared `satisfies` a record of TableDef (below), this is
 * a union of the actual tab names rather than plain `string` — so
 * `repo.table("Vehicle")` is a compile error, not a runtime surprise against a
 * live spreadsheet.
 */
export type TableName = keyof typeof TABLES;

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

/** Type guard for values arriving from outside (CSV imports, API params). */
export function isTableName(value: string): value is TableName {
  return Object.prototype.hasOwnProperty.call(TABLES, value);
}

export function getTable(name: TableName): TableDef {
  const t = TABLES[name];
  if (!t) throw new Error(`Unknown table: ${name}`);
  return t;
}

export const HEADER_ROW = 0;
