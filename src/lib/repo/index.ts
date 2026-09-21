import { getStore } from "../store";
import { DataStore, RecordRow, Row, WriteContext } from "../store/types";
import type { TableName } from "../store/tables";

/** Thin typed wrapper the services use; keeps sheet details out of business logic. */
export class Repo {
  constructor(readonly store: DataStore) {}

  table(name: TableName) {
    const s = this.store;
    return {
      async list(opts?: { activeOnly?: boolean; where?: (r: RecordRow) => boolean }) {
        return s.list(name, opts);
      },
      async get(id: string) {
        return s.get(name, id);
      },
      async create(data: Row, ctx: WriteContext) {
        return s.create(name, data, ctx);
      },
      async update(id: string, data: Row, expectedVersion: number, ctx: WriteContext) {
        return s.update(name, id, data, expectedVersion, ctx);
      },
      async archive(id: string, ctx: WriteContext) {
        return s.archive(name, id, ctx);
      }
    };
  }

  async settings(): Promise<Record<string, string>> {
    const rows = await this.store.list("Settings", { activeOnly: false });
    return Object.fromEntries(rows.map((r) => [r.id, r.value ?? ""]));
  }

  async getSetting(key: string): Promise<string | null> {
    return this.store.getSetting(key);
  }

  async setSetting(key: string, value: string, ctx: WriteContext): Promise<void> {
    await this.store.setSetting(key, value, ctx);
  }

  async staffList(): Promise<RecordRow[]> {
    return this.store.list("Staff", { activeOnly: false });
  }

  async logActivity(
    ctx: WriteContext,
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
    details?: unknown
  ): Promise<void> {
    await this.store
      .create(
        "ActivityLogs",
        {
          action,
          entityType,
          entityId,
          summary,
          detailsJson: details ? JSON.stringify(details) : ""
        },
        { actor: ctx.actor, operationId: ctx.operationId }
      )
      .catch(() => undefined);
  }

  async logStatusChange(
    ctx: WriteContext,
    entityType: string,
    entityId: string,
    fromState: string,
    toState: string,
    reason?: string
  ): Promise<void> {
    await this.store
      .create(
        "StatusHistory",
        {
          entityType,
          entityId,
          fromState,
          toState,
          reason: reason ?? "",
          at: new Date().toISOString()
        },
        { actor: ctx.actor, operationId: ctx.operationId }
      )
      .catch(() => undefined);
  }
}

/** Default repo bound to the configured store. */
export function getRepo(): Repo {
  return new Repo(getStore());
}

/** Test seam: repo over a provided store. */
export function repoFor(store: DataStore): Repo {
  return new Repo(store);
}
