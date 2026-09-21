/**
 * Runs apps-script/Gateway.gs inside Node against an in-memory spreadsheet.
 *
 * The gateway is ordinary ES5 JavaScript whose only dependencies are the Apps
 * Script globals, so mocking those globals lets the real deployed source be
 * executed and asserted against here — no Google account required. This is what
 * makes the "the gateway understands our action plans" claim testable rather
 * than assumed.
 */
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { TABLES } from "@/lib/store/tables";

type Cell = string | number | boolean;

class FakeSheet {
  rows: Cell[][] = [];
  constructor(readonly name: string, readonly headers: string[]) {
    this.rows.push([...headers]);
  }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return this.headers.length;
  }
  appendRow(row: Cell[]) {
    const padded = [...row];
    while (padded.length < this.headers.length) padded.push("");
    this.rows.push(padded);
  }
  getRange(row: number, col: number, numRows = 1, numCols = 1) {
    // Arrow properties so `this` stays the sheet rather than the returned range.
    return {
      getValues: () => {
        const out: Cell[][] = [];
        for (let r = 0; r < numRows; r++) {
          const source = this.rows[row - 1 + r] ?? [];
          const line: Cell[] = [];
          for (let c = 0; c < numCols; c++) line.push(source[col - 1 + c] ?? "");
          out.push(line);
        }
        return out;
      },
      setValues: (values: Cell[][]) => {
        for (let r = 0; r < values.length; r++) {
          const target = (this.rows[row - 1 + r] ??= []);
          const line = values[r]!;
          for (let c = 0; c < line.length; c++) target[col - 1 + c] = line[c]!;
        }
      },
      getValue: () => {
        return this.rows[row - 1]?.[col - 1] ?? "";
      },
      setValue: (v: Cell) => {
        (this.rows[row - 1] ??= [])[col - 1] = v;
      }
    };
  }
  /** Rows as objects, excluding the header. */
  objects(): Array<Record<string, string>> {
    return this.rows.slice(1).map((r) => {
      const o: Record<string, string> = {};
      this.headers.forEach((h, i) => (o[h] = r[i] === undefined || r[i] === null ? "" : String(r[i])));
      return o;
    });
  }
}

export interface GatewayHarness {
  post: (req: unknown, secret?: string) => { ok: boolean; error?: string; status?: number; replayed?: boolean; results?: { createdIds: Array<string | null>; updated: Array<Record<string, string>> } };
  sheet: (name: string) => FakeSheet;
  properties: Map<string, string>;
}

export function loadGateway(secret = "test-secret"): GatewayHarness {
  const sheets = new Map<string, FakeSheet>();
  for (const [name, def] of Object.entries(TABLES)) sheets.set(name, new FakeSheet(name, def.columns));
  const properties = new Map<string, string>([["HMAC_SECRET", secret]]);
  let uuidCounter = 0;

  const sandbox: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => sheets.get(n) ?? null
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, waitLock: () => true, releaseLock: () => undefined })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => properties.get(k) ?? null,
        setProperty: (k: string, v: string) => {
          properties.set(k, v);
        },
        deleteProperty: (k: string) => {
          properties.delete(k);
        },
        getProperties: () => Object.fromEntries(properties)
      })
    },
    Utilities: {
      getUuid: () => `gw-uuid-${++uuidCounter}`,
      MacAlgorithm: { HMAC_SHA_256: "HMAC_SHA_256" },
      computeHmacSignature: (_alg: string, value: string, key: string) =>
        Array.from(createHmac("sha256", key).update(value).digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64DecodeWebSafe: (b64: string) => Buffer.from(b64, "base64url"),
      newBlob: (buf: Buffer) => ({ getDataAsString: () => buf.toString("utf8") })
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (s: string) => ({ setMimeType: () => ({ getContent: () => s }) })
    },
    console
  };

  const src = fs.readFileSync(path.resolve(process.cwd(), "apps-script/Gateway.gs"), "utf8");
  const context = vm.createContext(sandbox);
  vm.runInContext(src, context);

  return {
    post(req: unknown, postSecret = secret) {
      const payload = JSON.stringify(req);
      const sig = createHmac("sha256", postSecret).update(payload).digest("hex");
      const envelope = `${Buffer.from(payload).toString("base64url")}.${sig}`;
      const doPost = sandbox.doPost as (e: unknown) => { getContent: () => string };
      const res = doPost({ postData: { contents: envelope } });
      return JSON.parse(res.getContent());
    },
    sheet: (name: string) => {
      const s = sheets.get(name);
      if (!s) throw new Error(`No such tab: ${name}`);
      return s;
    },
    properties
  };
}
