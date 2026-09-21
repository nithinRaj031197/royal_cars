import type { TableName } from "./tables";
import { Row } from "./types";

/**
 * Declarative critical-write actions.
 *
 * Critical sections are expressed as a list of plain actions so they can be
 * executed either locally under a mutex (demo/single-instance fallback) or by
 * the Apps Script gateway under a shared LockService lock (distributed mode).
 *
 * Values beginning with "$ref:<name>" are replaced with the id of an earlier
 * create action that declared `as: "<name>"`.
 */

export interface CreateAction {
  type: "create";
  table: TableName;
  /** Data to write. Values may use $ref templates. */
  data: Row;
  /** Name other actions can reference via "$ref:<name>". */
  as?: string;
  /** Explicit id (otherwise generated). */
  id?: string;
}

export interface UpdateAction {
  type: "update";
  table: TableName;
  /** Row id, or a $ref template. */
  id: string;
  data: Row;
  /** Optimistic version check under the lock. */
  expectedVersion?: number;
}

export interface AssertAction {
  type: "assert";
  table: TableName;
  /**
   * Fail if a non-archived row matching this predicate exists.
   * `and` adds required equality terms; `andNot` adds a required inequality.
   */
  notExists?: {
    field: string;
    equals: string;
    and?: Array<{ field: string; equals: string }>;
    andNot?: { field: string; equals: string };
  };
  /** Fail if no row matches: { field, equals } (and extra AND terms). */
  exists?: { field: string; equals: string; and?: Array<{ field: string; equals: string }> };
  /** Human-readable failure message. */
  message: string;
  /** HTTP status on failure (409 for conflicts). */
  status?: number;
}

export interface AssertFieldAction {
  type: "assert-field";
  table: TableName;
  id: string;
  field: string;
  equals?: string;
  notEquals?: string;
  /** Numeric comparison when set (value parsed from the field). */
  notGreaterThan?: number;
  message: string;
  status?: number;
}

/**
 * Totals a numeric column across matching rows and refuses the write when
 * adding `plus` would exceed `notGreaterThan`.
 *
 * Needed because guards like "no overpayment" depend on a SUM of other rows, so
 * checking them before the lock lets simultaneous payments each read the same
 * stale total and all pass. Evaluated inside the critical section instead.
 */
export interface AssertSumAction {
  type: "assert-sum";
  table: TableName;
  /** Numeric column to total (stored as a string, parsed with Number). */
  field: string;
  /** A row counts only when it matches every term. */
  where: Array<{ field: string; equals: string }>;
  /** Rows with any of these fields non-empty are excluded (e.g. "voidedAt"). */
  excludeWhenSet?: string[];
  /** The amount about to be written. */
  plus: number;
  /** The ceiling the running total may not exceed. */
  notGreaterThan: number;
  message: string;
  status?: number;
}

export type CriticalAction =
  | CreateAction
  | UpdateAction
  | AssertAction
  | AssertFieldAction
  | AssertSumAction;

/** Resolves $ref templates in a data row against created ids. */
export function resolveRefs(data: Row, refIds: Map<string, string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && v.startsWith("$ref:")) {
      const name = v.slice(5);
      const id = refIds.get(name);
      if (!id) throw new Error(`Unresolved $ref "${name}" in critical write`);
      out[k] = id;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resolveRefId(id: string, refIds: Map<string, string>): string {
  if (id.startsWith("$ref:")) {
    const name = id.slice(5);
    const resolved = refIds.get(name);
    if (!resolved) throw new Error(`Unresolved $ref "${name}" in critical write`);
    return resolved;
  }
  return id;
}
