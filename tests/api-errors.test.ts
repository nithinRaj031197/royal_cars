/**
 * API error mapping. A validation failure must reach the user as a 400 naming
 * the field, not as a 500 that hides the cause and logs a false server fault.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { StoreError, StaleEditError, NotFoundError } from "@/lib/store/types";

async function body(res: Response): Promise<{ error?: string }> {
  return (await res.json()) as { error?: string };
}

describe("errorResponse", () => {
  it("maps a Zod failure to 400 and names the offending field", async () => {
    const schema = z.object({ amount: z.number(), saleId: z.string().min(1, "Choose the sale") });
    let caught: unknown;
    try {
      schema.parse({ amount: 100, saleId: "" });
    } catch (err) {
      caught = err;
    }
    const res = errorResponse(caught);
    expect(res.status).toBe(400);
    const j = await body(res);
    expect(j.error).toContain("saleId");
    expect(j.error).toContain("Choose the sale");
  });

  it("passes through deliberate client errors with their own status", async () => {
    const res = errorResponse(Object.assign(new Error("Payment exceeds the balance due."), { status: 400 }));
    expect(res.status).toBe(400);
    expect((await body(res)).error).toBe("Payment exceeds the balance due.");

    const conflict = errorResponse(new StaleEditError("Sales", "abc"));
    expect(conflict.status).toBe(409);
    expect((await body(conflict)).error).toMatch(/changed by someone else/i);

    const missing = errorResponse(new NotFoundError("Sale"));
    expect(missing.status).toBe(404);

    const store = errorResponse(new StoreError("Vehicle is not available for reservation.", 409));
    expect(store.status).toBe(409);
  });

  it("hides the detail of genuine server faults", async () => {
    const res = errorResponse(new Error("connect ECONNREFUSED 10.0.0.1:443 sheets.googleapis.com"));
    expect(res.status).toBe(500);
    const j = await body(res);
    // The internal message must not leak to the client.
    expect(j.error).not.toContain("ECONNREFUSED");
    expect(j.error).toMatch(/something went wrong/i);
  });
});

/**
 * Business dates are the showroom's calendar date in Asia/Kolkata, not UTC.
 * Forms once defaulted to `new Date().toISOString().slice(0,10)`, which is the
 * UTC date — so between 00:00 and 05:30 IST every date field pre-filled
 * yesterday, quietly back-dating payments, inspections and deliveries.
 */
describe("business dates use IST, not UTC", () => {
  it("returns the IST calendar date when UTC is still on the previous day", async () => {
    const { toDateOnly } = await import("@/lib/dates");
    // 20:30 UTC on the 22nd is 02:00 IST on the 23rd.
    const lateUtc = new Date(Date.UTC(2026, 8, 22, 20, 30));
    expect(lateUtc.toISOString().slice(0, 10)).toBe("2026-09-22");
    expect(toDateOnly(lateUtc)).toBe("2026-09-23");
  });

  it("agrees with UTC during the rest of the day", async () => {
    const { toDateOnly } = await import("@/lib/dates");
    const midday = new Date(Date.UTC(2026, 8, 22, 9, 0)); // 14:30 IST, same date
    expect(toDateOnly(midday)).toBe("2026-09-22");
  });
});
