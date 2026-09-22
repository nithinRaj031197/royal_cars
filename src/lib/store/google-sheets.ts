import { GoogleAuth } from "google-auth-library";
import { googleAuthConfig } from "../config/google-credentials";
import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { getTable, TABLES, type TableName } from "./tables";
import {
  CriticalResult,
  DataStore,
  RecordRow,
  ReadOptions,
  Row,
  StoreError,
  StaleEditError,
  WriteContext
} from "./types";

import { nextVersion, newUUID, newOperationId } from "../ids";
import { CriticalAction } from "./actions";
import { GatewayRejectedError } from "./gateway";

type Sheets = sheets_v4.Sheets;

interface CacheEntry {
  rows: RecordRow[];
  /** sheet row index (1-based) for each record; header is row 1 */
  rowIndex: number[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 15_000;

export class GoogleSheetsStore implements DataStore {
  readonly kind = "google-sheets" as const;
  private auth: GoogleAuth;
  private sheetsClient: Sheets;
  private cache = new Map<TableName, CacheEntry>();
  private inflight = new Map<TableName, Promise<CacheEntry>>();

  constructor(readonly spreadsheetId: string, _serviceAccountFile?: string) {
    this.auth = new GoogleAuth(
      googleAuthConfig([
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ])
    );
    this.sheetsClient = google.sheets({ version: "v4", auth: this.auth });
  }

  // ---------- low-level helpers ----------

  private async withRetry<T>(fn: () => Promise<T>, what: string): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const status = (err as { code?: number; response?: { status?: number } })?.code
          ?? (err as { response?: { status?: number } })?.response?.status;
        const retryable = status === 429 || (typeof status === "number" && status >= 500) || status === undefined;
        if (!retryable || attempt === 3) break;
        await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 150)));
      }
    }
    throw new StoreError(`Google Sheets request failed (${what}): ${(lastErr as Error)?.message ?? "unknown"}`, 502);
  }

  private async getValues(range: string): Promise<string[][]> {
    const res = await this.withRetry(
      () => this.sheetsClient.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range }),
      `get ${range}`
    );
    return (res.data.values ?? []) as string[][];
  }

  private async ensureSpreadsheetAccessible(): Promise<void> {
    try {
      await this.withRetry(
        () => this.sheetsClient.spreadsheets.get({ spreadsheetId: this.spreadsheetId, fields: "sheets.properties.title" }),
        "spreadsheet get"
      );
    } catch (err) {
      throw new StoreError(
        `Cannot access spreadsheet ${this.spreadsheetId}. Check GOOGLE_SHEETS_ID and that the service account has Editor access. ${(err as Error).message}`,
        500
      );
    }
  }

  private async loadTable(table: TableName): Promise<CacheEntry> {
    const cached = this.cache.get(table);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
    const pending = this.inflight.get(table);
    if (pending) return pending;
    const p = (async () => {
      await this.ensureTable(table);
      const values = await this.getValues(`'${table}'!A1:ZZ`);
      const def = getTable(table);
      const header = values[0] ?? [];
      if (header.length > 0 && !columnsMatch(header, def.columns)) {
        throw new StoreError(
          `Sheet tab "${table}" has unexpected headers. Run \`pnpm sheets:validate\` for details. Refusing to read a modified schema.`,
          500
        );
      }
      const rows: RecordRow[] = [];
      const rowIndex: number[] = [];
      for (let i = 1; i < values.length; i++) {
        const raw = values[i] as string[];
        if (!raw || raw.every((c) => (c ?? "").trim() === "")) continue;
        const rec = rowToRecord(def.columns, raw);
        if (!rec.id) continue;
        rows.push(rec);
        rowIndex.push(i + 1); // 1-based sheet row
      }
      const entry: CacheEntry = { rows, rowIndex, fetchedAt: Date.now() };
      this.cache.set(table, entry);
      return entry;
    })().finally(() => this.inflight.delete(table));
    this.inflight.set(table, p);
    return p;
  }

  private invalidate(table?: TableName): void {
    if (table) this.cache.delete(table);
    else this.cache.clear();
  }

  private recordToRowArray(table: TableName, rec: RecordRow): string[] {
    const cols = getTable(table).columns;
    return cols.map((c) => cellValue(rec[c]));
  }

  // ---------- DataStore ----------

  async ensureTable(table: TableName): Promise<void> {
    const def = getTable(table);
    try {
      const meta = await this.withRetry(
        () => this.sheetsClient.spreadsheets.get({ spreadsheetId: this.spreadsheetId, fields: "sheets.properties.title" }),
        "spreadsheet get"
      );
      const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === table);
      if (!exists) {
        await this.withRetry(
          () =>
            this.sheetsClient.spreadsheets.batchUpdate({
              spreadsheetId: this.spreadsheetId,
              requestBody: { requests: [{ addSheet: { properties: { title: table } } }] }
            }),
          `addSheet ${table}`
        );
      }
      // A1:1 is the whole header row. A1:A1 is the single cell A1, which made
      // every schema check compare one value against the full column list and
      // fail — so no update could ever run against a real spreadsheet.
      const header = (await this.getValues(`'${table}'!A1:1`))[0] ?? [];
      if (header.length === 0) {
        await this.withRetry(
          () =>
            this.sheetsClient.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: `'${table}'!A1`,
              valueInputOption: "RAW",
              requestBody: { values: [def.columns] }
            }),
          `write header ${table}`
        );
      } else if (!columnsMatch(header, def.columns)) {
        throw new StoreError(
          `Tab "${table}" headers do not match the application schema. Manual edits are not supported; run \`pnpm sheets:validate\`.`,
          500
        );
      }
    } catch (err) {
      if (err instanceof StoreError) throw err;
      throw new StoreError(`Failed to ensure tab "${table}": ${(err as Error).message}`, 502);
    }
  }

  async list(table: TableName, opts?: ReadOptions): Promise<RecordRow[]> {
    const entry = await this.loadTable(table);
    let rows = entry.rows;
    if (opts?.activeOnly !== false) rows = rows.filter((r) => !r.archived);
    if (opts?.activeOnly === false) rows = entry.rows;
    if (opts?.where) rows = rows.filter(opts.where);
    return rows;
  }

  async get(table: TableName, id: string): Promise<RecordRow | null> {
    const entry = await this.loadTable(table);
    const idx = entry.rows.findIndex((r) => r.id === id);
    return idx >= 0 ? (entry.rows[idx] ?? null) : null;
  }

  async create(table: TableName, data: Row, ctx: WriteContext): Promise<RecordRow> {
    const def = getTable(table);
    void def;
    const now = new Date().toISOString();
    const opId = ctx.operationId ?? newOperationId();
    const rec = {
      id: data.id ?? newUUID(),
      ...Object.fromEntries(Object.entries(data).filter(([k]) => !isBaseColumn(k))),
      createdAt: now,
      updatedAt: now,
      version: 1,
      operationId: opId,
      createdBy: ctx.actor,
      updatedBy: ctx.actor,
      archived: false
    } as RecordRow;
    const rowArr = this.recordToRowArray(table, rec);
    await this.withRetry(
      () =>
        this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `'${table}'!A1`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [rowArr] }
        }),
      `append ${table}`
    );
    this.invalidate(table);
    return rec;
  }

  async update(table: TableName, id: string, data: Row, expectedVersion: number, ctx: WriteContext): Promise<RecordRow> {
    const entry = await this.loadTable(table);
    const idx = entry.rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new StoreError(`Record ${id} not found in ${table}`, 404);
    const existing = entry.rows[idx] as RecordRow;
    if (existing.version !== expectedVersion) throw new StaleEditError(table, id);
    const sheetRow = entry.rowIndex[idx] as number;
    const updated: RecordRow = {
      ...existing,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      version: nextVersion(existing.version),
      operationId: ctx.operationId ?? newOperationId(),
      updatedBy: ctx.actor
    } as RecordRow;
    await this.withRetry(
      () =>
        this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${table}'!A${sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [this.recordToRowArray(table, updated)] }
        }),
      `update ${table}`
    );
    this.invalidate(table);
    return updated;
  }

  async archive(table: TableName, id: string, ctx: WriteContext): Promise<void> {
    const entry = await this.loadTable(table);
    const idx = entry.rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new StoreError(`Record ${id} not found in ${table}`, 404);
    const sheetRow = entry.rowIndex[idx] as number;
    const existing = entry.rows[idx] as RecordRow;
    await this.withRetry(
      () =>
        this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${table}'!H${sheetRow}`,
          valueInputOption: "RAW",
          requestBody: { values: [["TRUE", new Date().toISOString(), String(nextVersion(existing.version)), ctx.operationId ?? newOperationId(), ctx.actor]] }
        }),
      `archive ${table}`
    );
    this.invalidate(table);
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.list("Settings", { activeOnly: false });
    const r = rows.find((x) => x.id === key);
    return r ? (r.value ?? "") : null;
  }

  async setSetting(key: string, value: string, ctx: WriteContext): Promise<void> {
    const rows = await this.list("Settings", { activeOnly: false });
    const existing = rows.find((x) => x.id === key);
    if (existing) {
      await this.update("Settings", existing.id, { value }, existing.version, ctx);
    } else {
      await this.create("Settings", { id: key, value }, ctx);
    }
  }

  /**
   * Critical mutations are serialized through the Apps Script gateway, which
   * validates the same assertions and applies every action under a shared
   * LockService lock. The browser/server never writes directly for these ops.
   */
  async runCritical(
    op: { operationId: string; kind: string; entityType: string; entityId?: string; actor: string; payload?: unknown },
    actions: CriticalAction[]
  ): Promise<CriticalResult> {
    const { postCriticalWrite } = await import("./gateway");
    try {
      const { results } = await postCriticalWrite({
        operationId: op.operationId,
        kind: op.kind,
        entityType: op.entityType,
        entityId: op.entityId,
        actor: op.actor,
        issuedAt: new Date().toISOString(),
        actions: actions as never
      });
      this.invalidate();
      return {
        createdIds: (results.createdIds as Array<string | null>) ?? [],
        updated: (results.updated as RecordRow[]) ?? [],
        refIds: (results.refIds as Record<string, string>) ?? {}
      };
    } catch (err) {
      // Record the failed/pending op so reconciliation can find it.
      await this.recordOperation(op, err instanceof GatewayRejectedError ? "failed" : "pending", (err as Error).message);
      throw err;
    }
  }

  async recordOperation(
    op: { operationId: string; kind: string; entityType: string; entityId?: string; actor: string; payload?: unknown },
    status: "pending" | "completed" | "failed",
    error?: string
  ): Promise<void> {
    try {
      const rows = await this.list("Operations", { activeOnly: false });
      const existing = rows.find((r) => r.id === op.operationId);
      const data: Row = {
        kind: op.kind,
        entityType: op.entityType,
        entityId: op.entityId ?? "",
        requestId: op.actor,
        status,
        attempts: existing ? String(Number(existing.attempts ?? "0") + 1) : "1",
        lastError: error ?? "",
        payloadJson: safeJson(op.payload),
        completedAt: status === "pending" ? "" : new Date().toISOString()
      };
      if (existing) await this.update("Operations", existing.id, data, existing.version, { actor: op.actor });
      else await this.create("Operations", { id: op.operationId, ...data }, { actor: op.actor });
    } catch {
      // Operation logging must never break the main flow.
    }
  }

  async validateAllTabs(): Promise<Array<{ table: string; ok: boolean; problem?: string }>> {
    await this.ensureSpreadsheetAccessible();
    const out: Array<{ table: string; ok: boolean; problem?: string }> = [];
    for (const name of Object.keys(TABLES) as TableName[]) {
      try {
        const def = getTable(name);
        const header = (await this.getValues(`'${name}'!A1:ZZ1`))[0] ?? [];
        if (header.length === 0) out.push({ table: name, ok: true }); // empty tab will be initialized
        else if (!columnsMatch(header, def.columns))
          out.push({ table: name, ok: false, problem: `Headers differ from schema (expected ${def.columns.length} columns)` });
        else out.push({ table: name, ok: true });
      } catch (err) {
        out.push({ table: name, ok: false, problem: (err as Error).message });
      }
    }
    return out;
  }
}

function isBaseColumn(k: string): boolean {
  return ["createdAt", "updatedAt", "version", "operationId", "createdBy", "updatedBy", "archived"].includes(k);
}

function columnsMatch(header: string[], expected: string[]): boolean {
  if (header.length < expected.length) return false;
  return expected.every((c, i) => (header[i] ?? "").trim() === c);
}

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

export function rowToRecord(columns: string[], raw: string[]): RecordRow {
  const rec = {
    id: "",
    createdAt: "",
    updatedAt: "",
    version: 1,
    operationId: "",
    createdBy: "",
    updatedBy: "",
    archived: false
  };
  columns.forEach((col, i) => {
    const v = raw[i] ?? "";
    if (col === "version") rec.version = Number(v || "1");
    else if (col === "archived") rec.archived = v === "TRUE" || v === "true";
    else (rec as unknown as Record<string, string>)[col] = v;
  });
  // Any extra columns beyond the schema are preserved opaquely.
  for (let i = columns.length; i < raw.length; i++) {
    (rec as unknown as Record<string, string>)[`extra_${i}`] = raw[i] ?? "";
  }
  return rec as RecordRow;
}

export function makeRowPayload(table: TableName, data: Row): string[] {
  const cols = getTable(table).columns;
  return cols.map((c) => cellValue(data[c]));
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return "";
  }
}
