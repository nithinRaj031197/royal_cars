import { DemoStore } from "./demo-store";
import { GoogleSheetsStore } from "./google-sheets";
import { DataStore } from "./types";
import { envConfig } from "../config/env";

let cached: DataStore | null = null;

/** Returns the configured store: Google Sheets in production, DemoStore in demo mode. */
export function getStore(): DataStore {
  if (cached) return cached;
  if (envConfig.demoMode) {
    cached = getDemoStore();
    return cached;
  }
  const sheetsId = envConfig.sheetsId;
  const saFile = envConfig.serviceAccountFile;
  if (!sheetsId || !saFile) {
    throw new Error(
      "Missing GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_FILE. Configure Google access or set DEMO_MODE=1."
    );
  }
  cached = new GoogleSheetsStore(sheetsId, saFile);
  return cached;
}

// Module-level singleton so dev-server hot reloads keep one demo dataset.
const globalStore = globalThis as unknown as { __demoStore?: DemoStore };

export function getDemoStore(): DemoStore {
  if (!globalStore.__demoStore) {
    const store = new DemoStore();
    // Populate the fictional showroom on first use, so a demo server always has
    // a full lifecycle to look at. Tests construct DemoStore directly and stay
    // empty. Imported lazily to keep the seed dataset out of other bundles.
    store.seedWith(async (s) => {
      const { seedDemoData } = await import("@/server/demo-seed");
      await seedDemoData(s);
    });
    globalStore.__demoStore = store;
  }
  return globalStore.__demoStore;
}

/** Test seam: run a block against a fresh in-memory store. */
export async function withDemoStore<T>(fn: (store: DataStore) => Promise<T>): Promise<T> {
  const prev = cached;
  const store = new DemoStore();
  cached = store;
  try {
    return await fn(store);
  } finally {
    cached = prev;
  }
}

/** Test seam: bind the singleton to an explicit store (e.g. a test DemoStore). */
export function setStoreForTests(store: DataStore | null): void {
  cached = store;
}

export function isDemoMode(): boolean {
  return envConfig.demoMode;
}
