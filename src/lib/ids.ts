import { randomUUID } from "node:crypto";

export function newUUID(): string {
  return randomUUID();
}

export function newOperationId(): string {
  return `op_${randomUUID()}`;
}

/** Record version for stale-edit detection; bumped on every write. */
export function nextVersion(v: number | null | undefined): number {
  return (v ?? 0) + 1;
}

function ref(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

/**
 * Human-readable sequential references like STK-00042.
 * Counters are stored in the Settings tab; generation is retried on collision.
 */
export function makeRef(prefix: string, counter: number): string {
  return ref(prefix, counter);
}

export const REF_PREFIXES = {
  seller: "SLR",
  vehicle: "STK",
  acquisition: "ACQ",
  inspection: "INS",
  workOrder: "WO",
  purchasePayment: "PP",
  expense: "EXP",
  customer: "CUS",
  lead: "LEAD",
  followUp: "FU",
  testDrive: "TD",
  reservation: "RES",
  sale: "SAL",
  salePayment: "SP",
  delivery: "DLV",
  serviceCommitment: "SC",
  serviceRequest: "SR",
  serviceJob: "SJ",
  importBatch: "IMP",
  vendor: "VND"
} as const;

export type RefPrefixKey = keyof typeof REF_PREFIXES;

/** Normalize a phone number for comparison (digits only, keep leading zeros). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/** Defensive CSV cell check: never treat formulas as data on import. */
export function looksLikeFormula(value: string): boolean {
  return /^[=+\-@\t\r]|^"=/.test(value);
}
