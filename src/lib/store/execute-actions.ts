/**
 * Executes a CriticalAction[] against a store. Called only while the caller
 * holds the serialization lock (demo mutex or Apps Script LockService).
 */
import { DataStore, RecordRow, WriteContext } from "./types";
import { CriticalAction, resolveRefId, resolveRefs } from "./actions";
import { newUUID } from "../ids";

export interface ExecResult {
  createdIds: Array<string | null>;
  refIds: Map<string, string>;
  updated: RecordRow[];
}

export async function executeActions(
  store: DataStore,
  actions: CriticalAction[],
  actor: string,
  operationId: string
): Promise<ExecResult> {
  const createdIds: Array<string | null> = [];
  const refIds = new Map<string, string>();
  const updated: RecordRow[] = [];
  const ctx: WriteContext = { actor, operationId };

  for (const action of actions) {
    if (action.type === "assert") {
      const rows = await store.list(action.table, { activeOnly: true });
      if (action.notExists) {
        const cond = action.notExists;
        const hit = rows.find((r) =>
          (r[cond.field] ?? "") === cond.equals &&
          (cond.and ?? []).every((t) => (r[t.field] ?? "") === t.equals) &&
          (!cond.andNot || (r[cond.andNot.field] ?? "") !== cond.andNot.equals)
        );
        if (hit) {
          throw Object.assign(new Error(action.message), { status: action.status ?? 409 });
        }
      }
      if (action.exists) {
        const cond = action.exists;
        const hit = rows.find((r) =>
          (r[cond.field] ?? "") === cond.equals &&
          (cond.and ?? []).every((t) => (r[t.field] ?? "") === t.equals)
        );
        if (!hit) {
          throw Object.assign(new Error(action.message), { status: action.status ?? 400 });
        }
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === "assert-field") {
      const id = resolveRefId(action.id, refIds);
      const row = await store.get(action.table, id);
      if (!row) throw Object.assign(new Error(action.message), { status: 404 });
      const value = row[action.field] ?? "";
      if (action.equals !== undefined && value !== action.equals) {
        throw Object.assign(new Error(action.message), { status: action.status ?? 400 });
      }
      if (action.notEquals !== undefined && value === action.notEquals) {
        throw Object.assign(new Error(action.message), { status: action.status ?? 409 });
      }
      if (action.notGreaterThan !== undefined && Number(value) > action.notGreaterThan) {
        throw Object.assign(new Error(action.message), { status: action.status ?? 400 });
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === "assert-sum") {
      const rows = await store.list(action.table, { activeOnly: true });
      const matching = rows.filter(
        (r) =>
          action.where.every((t) => (r[t.field] ?? "") === t.equals) &&
          !(action.excludeWhenSet ?? []).some((f) => (r[f] ?? "") !== "")
      );
      const total = matching.reduce((acc, r) => acc + Number(r[action.field] ?? "0"), 0);
      if (total + action.plus > action.notGreaterThan) {
        throw Object.assign(new Error(action.message), { status: action.status ?? 400 });
      }
      createdIds.push(null);
      continue;
    }

    if (action.type === "create") {
      const id = action.id ?? newUUID();
      const data = resolveRefs(action.data, refIds);
      await store.create(action.table, { ...data, id }, ctx);
      createdIds.push(id);
      if (action.as) refIds.set(action.as, id);
      continue;
    }

    if (action.type === "update") {
      const id = resolveRefId(action.id, refIds);
      const data = resolveRefs(action.data, refIds);
      let expected = action.expectedVersion;
      if (expected === undefined) {
        // Read current version; safe because we hold the serialization lock.
        const existing = await store.get(action.table, id);
        if (!existing) throw new Error(`Critical update target not found: ${action.table}/${id}`);
        expected = existing.version;
      }
      const row = await store.update(action.table, id, data, expected, ctx);
      updated.push(row);
      createdIds.push(null);
    }
  }

  return { createdIds, refIds, updated };
}
