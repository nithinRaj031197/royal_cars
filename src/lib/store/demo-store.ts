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
import { getTable } from "./tables";
import { CriticalAction } from "./actions";
import { executeActions } from "./execute-actions";
import { newUUID, newOperationId, nextVersion } from "../ids";

/**
 * Demo store: in-memory tables implementing the exact same contract as
 * GoogleSheetsStore so every business rule, validation and flow runs
 * identically without Google credentials. Demo data lives for the server
 * process lifetime (or is seeded by scripts/sheets-seed.ts in demo mode).
 */
export class DemoStore implements DataStore {
  readonly kind = "demo" as const;
  private tables = new Map<string, RecordRow[]>();
  private mutex: Promise<unknown> = Promise.resolve();
  private seedPromise: Promise<void> | null = null;

  /**
   * Populates an empty demo store once, before the first read or write.
   *
   * The seeder is handed the unlocked view, so its own writes never re-enter
   * `ready()` (which would await the seed it is itself performing) and never
   * queue behind the mutex. Every public entry point awaits the same promise,
   * so concurrent first requests all see a fully seeded store.
   */
  seedWith(seeder: (store: DataStore) => Promise<void>): void {
    if (this.seedPromise) return;
    this.seedPromise = seeder(this.unlockedView()).catch((err) => {
      console.error("[demo] seeding failed:", (err as Error).message);
    });
  }

  private async ready(): Promise<void> {
    if (this.seedPromise) await this.seedPromise;
  }

  /**
   * Serializes a mutation against every other top-level mutation.
   *
   * Writes issued from inside a critical section must NOT come back through
   * here: they already run under the lock, and re-entering would wait on a
   * lock the caller itself holds (a deadlock). Those writes go direct to the
   * *Unlocked methods via `unlockedView()`.
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutex.then(fn, fn);
    this.mutex = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async ensureTable(table: string): Promise<void> {
    if (!this.tables.has(table)) this.tables.set(table, []);
  }

  async list(table: string, opts?: ReadOptions): Promise<RecordRow[]> {
    await this.ready();
    await this.ensureTable(table);
    const all = this.tables.get(table) ?? [];
    let rows = opts?.activeOnly === false ? all.slice() : all.filter((r) => !r.archived);
    if (opts?.where) rows = rows.filter(opts.where);
    return rows;
  }

  async get(table: string, id: string): Promise<RecordRow | null> {
    const rows = await this.list(table, { activeOnly: false });
    return rows.find((r) => r.id === id) ?? null;
  }

  /** ---- Unlocked primitives: the actual mutations, no locking. ---- */

  private async createUnlocked(table: string, data: Row, ctx: WriteContext): Promise<RecordRow> {
    await this.ensureTable(table);
    void getTable; // schema registry is authoritative in Sheets mode
    const now = new Date().toISOString();
    const rec = {
      id: data.id ?? newUUID(),
      ...Object.fromEntries(Object.entries(data).filter(([k]) => !isBase(k))),
      createdAt: now,
      updatedAt: now,
      version: 1,
      operationId: ctx.operationId ?? newOperationId(),
      createdBy: ctx.actor,
      updatedBy: ctx.actor,
      archived: false
    } as RecordRow;
    this.tables.get(table)!.push(rec);
    return rec;
  }

  private async updateUnlocked(
    table: string,
    id: string,
    data: Row,
    expectedVersion: number,
    ctx: WriteContext
  ): Promise<RecordRow> {
    const rows = this.tables.get(table) ?? [];
    const rec = rows.find((r) => r.id === id);
    if (!rec) throw new StoreError(`Record ${id} not found in ${table}`, 404);
    if (rec.version !== expectedVersion) throw new StaleEditError(table, id);
    const updated: RecordRow = {
      ...rec,
      ...data,
      id,
      updatedAt: new Date().toISOString(),
      version: nextVersion(rec.version),
      operationId: ctx.operationId ?? newOperationId(),
      updatedBy: ctx.actor
    } as RecordRow;
    rows[rows.indexOf(rec)] = updated;
    return updated;
  }

  private async archiveUnlocked(table: string, id: string, ctx: WriteContext): Promise<void> {
    const rows = this.tables.get(table) ?? [];
    const rec = rows.find((r) => r.id === id);
    if (!rec) throw new StoreError(`Record ${id} not found in ${table}`, 404);
    rows[rows.indexOf(rec)] = {
      ...rec,
      archived: true,
      updatedAt: new Date().toISOString(),
      version: nextVersion(rec.version),
      operationId: ctx.operationId ?? newOperationId(),
      updatedBy: ctx.actor
    } as RecordRow;
  }

  /** ---- Public API: same primitives, serialized. ---- */

  async create(table: string, data: Row, ctx: WriteContext): Promise<RecordRow> {
    await this.ready();
    return this.enqueue(() => this.createUnlocked(table, data, ctx));
  }

  async update(table: string, id: string, data: Row, expectedVersion: number, ctx: WriteContext): Promise<RecordRow> {
    await this.ready();
    return this.enqueue(() => this.updateUnlocked(table, id, data, expectedVersion, ctx));
  }

  async archive(table: string, id: string, ctx: WriteContext): Promise<void> {
    await this.ready();
    await this.enqueue(() => this.archiveUnlocked(table, id, ctx));
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.list("Settings", { activeOnly: false });
    const r = rows.find((x) => x.id === key);
    return r ? (r.value ?? "") : null;
  }

  async setSetting(key: string, value: string, ctx: WriteContext): Promise<void> {
    await this.enqueue(async () => {
      const rows = await this.list("Settings", { activeOnly: false });
      const existing = rows.find((x) => x.id === key);
      if (existing) await this.updateUnlocked("Settings", existing.id, { value }, existing.version, ctx);
      else await this.createUnlocked("Settings", { id: key, value }, ctx);
    });
  }

  /**
   * A view whose writes bypass the mutex, for use *inside* a critical section.
   * Reads are unchanged. Never hand this to callers outside the lock.
   */
  private unlockedView(): DataStore {
    // Every member below is an arrow function, so `this` is already bound
    // lexically to the store — no alias needed.
    return {
      kind: this.kind,
      list: (t, o) => this.list(t, o),
      get: (t, id) => this.get(t, id),
      ensureTable: (t) => this.ensureTable(t),
      getSetting: (k) => this.getSetting(k),
      create: (t, d, c) => this.createUnlocked(t, d, c),
      update: (t, id, d, v, c) => this.updateUnlocked(t, id, d, v, c),
      archive: (t, id, c) => this.archiveUnlocked(t, id, c),
      setSetting: async (k, v, c) => {
        const rows = await this.list("Settings", { activeOnly: false });
        const existing = rows.find((x) => x.id === k);
        if (existing) await this.updateUnlocked("Settings", existing.id, { value: v }, existing.version, c);
        else await this.createUnlocked("Settings", { id: k, value: v }, c);
      },
      runCritical: () => {
        throw new Error("Nested runCritical is not allowed");
      }
    };
  }

  /** Local mutex: sufficient for the single-process demo, NOT a distributed lock. */
  async runCritical(
    op: { operationId: string; kind: string; entityType: string; entityId?: string; actor: string; payload?: unknown },
    actions: CriticalAction[]
  ): Promise<CriticalResult> {
    await this.ready();
    return this.enqueue(async () => {
      const r = await executeActions(this.unlockedView(), actions, op.actor, op.operationId);
      return { createdIds: r.createdIds, updated: r.updated, refIds: Object.fromEntries(r.refIds) };
    });
  }

  /** Snapshot for tests/inspection. */
  dump(table: string): RecordRow[] {
    return (this.tables.get(table) ?? []).slice();
  }
}

function isBase(k: string): boolean {
  return ["createdAt", "updatedAt", "version", "operationId", "createdBy", "updatedBy", "archived"].includes(k);
}
