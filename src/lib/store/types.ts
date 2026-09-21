import { getTable, type TableName } from "./tables";
import { CriticalAction } from "./actions";

export type Row = Record<string, string>;

/** A validated record: string cells plus strongly-typed metadata columns. */
export type RecordRow = Row & {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  operationId: string;
  createdBy: string;
  updatedBy: string;
  archived: boolean;
};

/**
 * Outcome of a serialized critical write.
 *
 * `refIds` maps each create action's `as` name to the id it was given. Prefer it
 * over `createdIds`, whose positions shift whenever an action is inserted into
 * a plan.
 */
export interface CriticalResult {
  createdIds: Array<string | null>;
  updated: RecordRow[];
  refIds: Record<string, string>;
}

export interface ReadOptions {
  activeOnly?: boolean;
  where?: (row: RecordRow) => boolean;
}

export interface WriteContext {
  actor: string;
  operationId?: string;
}

/** Data store abstraction used by the repository layer. */
export interface DataStore {
  readonly kind: "google-sheets" | "demo";
  readonly spreadsheetId?: string;

  /** Reads all rows of a tab as validated records. */
  list(table: TableName, opts?: ReadOptions): Promise<RecordRow[]>;
  get(table: TableName, id: string): Promise<RecordRow | null>;

  /** Creates a row, assigning id/audit columns. Returns the stored record. */
  create(table: TableName, data: Row, ctx: WriteContext): Promise<RecordRow>;
  /** Updates by id. versionNow must match the stored version or the write is rejected. */
  update(table: TableName, id: string, data: Row, expectedVersion: number, ctx: WriteContext): Promise<RecordRow>;
  /** Soft delete (archive). Financial records should use void workflows instead. */
  archive(table: TableName, id: string, ctx: WriteContext): Promise<void>;
  /** Validates that the tab exists with the expected headers; creates it if missing (Sheets mode). */
  ensureTable(table: TableName): Promise<void>;

  /** Settings tab helpers. */
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string, ctx: WriteContext): Promise<void>;

  /**
   * Serialized critical mutation. All competing writes must go through this.
   * In Sheets mode this posts the action plan to the Apps Script gateway
   * (shared LockService lock); in demo mode the plan runs under a local mutex.
   * Both paths validate the same assertions before writing.
   */
  runCritical(
    op: { operationId: string; kind: string; entityType: string; entityId?: string; actor: string; payload?: unknown },
    actions: CriticalAction[]
  ): Promise<CriticalResult>;
}

export class StoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export class StaleEditError extends StoreError {
  constructor(table: string, id: string) {
    super(`This ${table} record was changed by someone else. Reload and try again.`, 409);
    this.name = "StaleEditError";
    void table;
    void id;
  }
}

export class NotFoundError extends StoreError {
  constructor(entity: string) {
    super(`${entity} not found`, 404);
    this.name = "NotFoundError";
  }
}

export function makeRecord(table: string, data: Row, ctx: WriteContext, now: string): RecordRow {
  void table;
  return {
    ...data,
    id: typeof data.id === "string" && data.id ? data.id : "",
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : now,
    updatedAt: now,
    version: 1,
    operationId: ctx.operationId ?? "",
    createdBy: ctx.actor,
    updatedBy: ctx.actor,
    archived: false
  } as RecordRow;
}

export function baseColumns(data: Row): { base: Row; rest: Row } {
  const { id, createdAt, updatedAt, version, operationId, createdBy, updatedBy, archived, ...rest } = data;
  const base: Row = {};
  if (id !== undefined) base.id = id;
  if (createdAt !== undefined) base.createdAt = createdAt;
  if (updatedAt !== undefined) base.updatedAt = updatedAt;
  if (version !== undefined) base.version = String(version);
  if (operationId !== undefined) base.operationId = operationId;
  if (createdBy !== undefined) base.createdBy = createdBy;
  if (updatedBy !== undefined) base.updatedBy = updatedBy;
  if (archived !== undefined) base.archived = String(archived);
  return { base, rest };
}

export function tableColumns(table: TableName): string[] {
  return getTable(table).columns;
}
