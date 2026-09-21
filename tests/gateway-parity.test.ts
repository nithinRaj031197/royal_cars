/**
 * Gateway parity: apps-script/Gateway.gs must execute CriticalAction[] plans
 * with the same semantics as src/lib/store/execute-actions.ts.
 *
 * Production routes critical writes (reservations, sales, payments, delivery)
 * through the Apps Script gateway, while the demo store and every other test
 * exercise executeActions. If the two disagree, the app is verified against
 * behaviour production never runs. These tests run the SAME plans through both.
 */
import { describe, it, expect } from "vitest";
import { loadGateway } from "./apps-script-harness";
import { DemoStore } from "@/lib/store/demo-store";
import { executeActions } from "@/lib/store/execute-actions";
import type { CriticalAction } from "@/lib/store/actions";

const ACTOR = "owner@test";

function request(actions: CriticalAction[], operationId = "op-1") {
  return {
    operationId,
    kind: "test.plan",
    entityType: "Reservations",
    actor: ACTOR,
    issuedAt: new Date().toISOString(),
    actions
  };
}

/** Runs a plan through the demo engine, returning the same shape the gateway returns. */
async function runLocally(store: DemoStore, actions: CriticalAction[], operationId = "op-1") {
  try {
    const r = await executeActions(store, actions, ACTOR, operationId);
    return { ok: true as const, createdIds: r.createdIds };
  } catch (err) {
    const e = err as { message: string; status?: number };
    return { ok: false as const, error: e.message, status: e.status };
  }
}

/** A reservation plan: the exact shape services/sales.ts builds. */
function reservationPlan(vehicleId: string, customerId: string): CriticalAction[] {
  return [
    {
      type: "assert",
      table: "Reservations",
      notExists: { field: "vehicleId", equals: vehicleId, and: [{ field: "status", equals: "Active" }] },
      message: "This vehicle already has an active reservation.",
      status: 409
    },
    {
      type: "assert",
      table: "Sales",
      notExists: { field: "vehicleId", equals: vehicleId, andNot: { field: "status", equals: "Cancelled" } },
      message: "This vehicle already has an active sale.",
      status: 409
    },
    {
      type: "create",
      table: "Reservations",
      as: "reservation",
      data: {
        reservationRef: "RES-TEST",
        vehicleId,
        customerId,
        agreedPricePaise: "68000000",
        bookingAmountPaise: "2500000",
        bookingDate: "2026-09-18",
        expiresOn: "2026-09-25",
        status: "Active"
      }
    },
    {
      type: "update",
      table: "Vehicles",
      id: vehicleId,
      data: { lifecycleState: "Reserved" }
    }
  ];
}

async function seedVehicle(store: DemoStore, gw: ReturnType<typeof loadGateway>, id: string) {
  await store.create("Vehicles", { id, stockRef: "STK-1", lifecycleState: "Ready for sale" }, { actor: ACTOR });
  const headers = gw.sheet("Vehicles").headers;
  const row = headers.map((h) => {
    if (h === "id") return id;
    if (h === "version") return 1;
    if (h === "archived") return "FALSE";
    if (h === "stockRef") return "STK-1";
    if (h === "lifecycleState") return "Ready for sale";
    return "";
  });
  gw.sheet("Vehicles").appendRow(row);
}

describe("gateway parity with executeActions", () => {
  it("applies a reservation plan identically in both engines", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await seedVehicle(store, gw, "veh-1");

    const plan = reservationPlan("veh-1", "cust-1");
    const local = await runLocally(store, plan);
    const remote = gw.post(request(plan));

    expect(local.ok).toBe(true);
    expect(remote.ok).toBe(true);

    // createdIds must be positionally aligned: services read result.createdIds[2].
    expect(local.createdIds).toHaveLength(4);
    expect(remote.results!.createdIds).toHaveLength(4);
    expect(local.createdIds!.map((v) => v === null)).toEqual([true, true, false, true]);
    expect(remote.results!.createdIds.map((v) => v === null)).toEqual([true, true, false, true]);

    // Same business outcome in both stores.
    const localRes = (await store.list("Reservations"))[0]!;
    const remoteRes = gw.sheet("Reservations").objects()[0]!;
    expect(localRes.status).toBe("Active");
    expect(remoteRes.status).toBe("Active");
    expect(remoteRes.vehicleId).toBe("veh-1");
    expect(remoteRes.agreedPricePaise).toBe("68000000");

    expect((await store.get("Vehicles", "veh-1"))!.lifecycleState).toBe("Reserved");
    expect(gw.sheet("Vehicles").objects()[0]!.lifecycleState).toBe("Reserved");

    // Audit columns are stamped by the gateway, not left to the caller.
    expect(remoteRes.createdBy).toBe(ACTOR);
    expect(remoteRes.operationId).toBe("op-1");
    expect(remoteRes.version).toBe("1");
    expect(remoteRes.archived).toBe("FALSE");
  });

  it("rejects a competing reservation with the same message and status", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await seedVehicle(store, gw, "veh-1");

    await runLocally(store, reservationPlan("veh-1", "cust-1"));
    gw.post(request(reservationPlan("veh-1", "cust-1"), "op-1"));

    const plan2 = reservationPlan("veh-1", "cust-2");
    const local = await runLocally(store, plan2, "op-2");
    const remote = gw.post(request(plan2, "op-2"));

    expect(local.ok).toBe(false);
    expect(remote.ok).toBe(false);
    expect(local.error).toBe("This vehicle already has an active reservation.");
    expect(remote.error).toBe("This vehicle already has an active reservation.");
    expect(local.status).toBe(409);
    expect(remote.status).toBe(409);
    // Nothing partially written by the rejected plan.
    expect((await store.list("Reservations")).length).toBe(1);
    expect(gw.sheet("Reservations").objects().length).toBe(1);
  });

  it("lets a cancelled reservation be replaced (status-qualified assert)", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await seedVehicle(store, gw, "veh-1");

    await runLocally(store, reservationPlan("veh-1", "cust-1"));
    gw.post(request(reservationPlan("veh-1", "cust-1"), "op-1"));

    // Cancel it in both engines.
    const localRes = (await store.list("Reservations"))[0]!;
    await store.update("Reservations", localRes.id, { status: "Cancelled" }, localRes.version, { actor: ACTOR });
    const gwRows = gw.sheet("Reservations");
    gwRows.rows[1]![gwRows.headers.indexOf("status")] = "Cancelled";

    const plan2 = reservationPlan("veh-1", "cust-2");
    const local = await runLocally(store, plan2, "op-2");
    const remote = gw.post(request(plan2, "op-2"));

    expect(local.ok).toBe(true);
    expect(remote.ok).toBe(true);
    expect((await store.list("Reservations")).length).toBe(2);
    expect(gw.sheet("Reservations").objects().length).toBe(2);
  });

  it("resolves $ref templates so linked ids are real, in both engines", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await store.create("Sales", { id: "sale-1", saleRef: "SAL-1", status: "Part paid" }, { actor: ACTOR });
    const sh = gw.sheet("Sales");
    sh.appendRow(sh.headers.map((h) => (h === "id" ? "sale-1" : h === "version" ? 1 : h === "archived" ? "FALSE" : h === "status" ? "Part paid" : h === "saleRef" ? "SAL-1" : "")));

    const plan: CriticalAction[] = [
      {
        type: "create",
        table: "DeliveryChecklists",
        as: "checklist",
        data: { checklistRef: "DLV-1", saleId: "sale-1", status: "Completed" }
      },
      {
        type: "update",
        table: "Sales",
        id: "sale-1",
        data: { status: "Delivered", deliveryChecklistId: "$ref:checklist" }
      }
    ];

    const local = await runLocally(store, plan, "op-dlv");
    const remote = gw.post(request(plan, "op-dlv"));
    expect(local.ok).toBe(true);
    expect(remote.ok).toBe(true);

    const localChecklistId = local.createdIds![0]!;
    expect((await store.get("Sales", "sale-1"))!.deliveryChecklistId).toBe(localChecklistId);

    const remoteChecklistId = remote.results!.createdIds[0]!;
    const remoteSale = gw.sheet("Sales").objects()[0]!;
    expect(remoteSale.deliveryChecklistId).toBe(remoteChecklistId);
    // The point of the check: a literal "$ref:..." must never reach the sheet.
    expect(remoteSale.deliveryChecklistId).not.toContain("$ref");
    expect(remoteSale.status).toBe("Delivered");
    expect(remoteSale.version).toBe("2");
  });

  it("enforces assert-field and optimistic version checks", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await store.create("Reservations", { id: "res-1", status: "Cancelled" }, { actor: ACTOR });
    const sh = gw.sheet("Reservations");
    sh.appendRow(sh.headers.map((h) => (h === "id" ? "res-1" : h === "version" ? 1 : h === "archived" ? "FALSE" : h === "status" ? "Cancelled" : "")));

    const plan: CriticalAction[] = [
      {
        type: "assert-field",
        table: "Reservations",
        id: "res-1",
        field: "status",
        equals: "Active",
        message: "Only active reservations can be cancelled.",
        status: 400
      }
    ];
    const local = await runLocally(store, plan, "op-af");
    const remote = gw.post(request(plan, "op-af"));
    expect(local.ok).toBe(false);
    expect(remote.ok).toBe(false);
    expect(remote.error).toBe("Only active reservations can be cancelled.");
    expect(local.status).toBe(400);
    expect(remote.status).toBe(400);

    // Stale version is refused by both.
    const stale: CriticalAction[] = [
      { type: "update", table: "Reservations", id: "res-1", expectedVersion: 99, data: { status: "Active" } }
    ];
    const localStale = await runLocally(store, stale, "op-stale");
    const remoteStale = gw.post(request(stale, "op-stale"));
    expect(localStale.ok).toBe(false);
    expect(remoteStale.ok).toBe(false);
    expect(remoteStale.status).toBe(409);
    expect(gw.sheet("Reservations").objects()[0]!.status).toBe("Cancelled");
  });

  it("is idempotent: a replayed operationId does not write twice", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await seedVehicle(store, gw, "veh-1");

    const plan = reservationPlan("veh-1", "cust-1");
    const first = gw.post(request(plan, "op-retry"));
    expect(first.ok).toBe(true);
    expect(first.replayed).toBeUndefined();

    // Same operationId again — e.g. the app retried after a network timeout.
    const second = gw.post(request(plan, "op-retry"));
    expect(second.ok).toBe(true);
    expect(second.replayed).toBe(true);
    expect(second.results!.createdIds).toEqual(first.results!.createdIds);
    // Exactly one reservation exists, and the vehicle was not bumped twice.
    expect(gw.sheet("Reservations").objects().length).toBe(1);
    expect(gw.sheet("Vehicles").objects()[0]!.version).toBe("2");
  });

  it("evaluates assert-sum identically, blocking overpayment under the lock", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    // A ₹6,00,000 sale with ₹5,00,000 already paid across two payments.
    await store.create("Sales", { id: "sale-1", finalNetPricePaise: "60000000", status: "Part paid" }, { actor: ACTOR });
    const sh = gw.sheet("Sales");
    sh.appendRow(sh.headers.map((h) => (h === "id" ? "sale-1" : h === "version" ? 1 : h === "archived" ? "FALSE" : h === "finalNetPricePaise" ? "60000000" : h === "status" ? "Part paid" : "")));

    for (const [id, amt, voided] of [["p1", "30000000", ""], ["p2", "20000000", ""], ["p3", "10000000", "2026-01-01"]] as const) {
      await store.create("SalePayments", { id, saleId: "sale-1", amountPaise: amt, voidedAt: voided }, { actor: ACTOR });
      const ps = gw.sheet("SalePayments");
      ps.appendRow(ps.headers.map((h) =>
        h === "id" ? id : h === "version" ? 1 : h === "archived" ? "FALSE" :
        h === "saleId" ? "sale-1" : h === "amountPaise" ? amt : h === "voidedAt" ? voided : ""));
    }

    const guard = (plus: number): CriticalAction[] => [
      {
        type: "assert-sum",
        table: "SalePayments",
        field: "amountPaise",
        where: [{ field: "saleId", equals: "sale-1" }],
        excludeWhenSet: ["voidedAt"],
        plus,
        notGreaterThan: 60000000,
        message: "Payment exceeds the balance due for this sale.",
        status: 400
      },
      { type: "create", table: "SalePayments", as: "payment", data: { saleId: "sale-1", amountPaise: String(plus) } }
    ];

    // ₹1,00,000 fits exactly into the remaining balance (the voided ₹1L is excluded).
    const okLocal = await runLocally(store, guard(10000000), "op-ok");
    const okRemote = gw.post(request(guard(10000000), "op-ok"));
    expect(okLocal.ok).toBe(true);
    expect(okRemote.ok).toBe(true);

    // A further ₹1 must now be refused by both engines.
    const badLocal = await runLocally(store, guard(100), "op-bad");
    const badRemote = gw.post(request(guard(100), "op-bad"));
    expect(badLocal.ok).toBe(false);
    expect(badRemote.ok).toBe(false);
    expect(badLocal.error).toBe("Payment exceeds the balance due for this sale.");
    expect(badRemote.error).toBe("Payment exceeds the balance due for this sale.");
    expect(badRemote.status).toBe(400);
  });

  it("returns refIds so services need not depend on action positions", async () => {
    const gw = loadGateway();
    const store = new DemoStore();
    await seedVehicle(store, gw, "veh-1");
    const plan = reservationPlan("veh-1", "cust-1");

    // Gateway: the named ref maps to the id of the create that declared it.
    const remote = gw.post(request(plan, "op-refs"));
    expect(remote.ok).toBe(true);
    const remoteRefs = (remote.results as unknown as { refIds: Record<string, string> }).refIds;
    expect(remoteRefs.reservation).toBe(remote.results!.createdIds[2]);
    expect(gw.sheet("Reservations").objects()[0]!.id).toBe(remoteRefs.reservation);

    // Demo engine: same contract, via the public runCritical API.
    const local = await store.runCritical(
      { operationId: "op-refs-local", kind: "reservation.create", entityType: "Reservations", actor: ACTOR },
      plan
    );
    expect(local.refIds.reservation).toBe(local.createdIds[2]);
    expect((await store.list("Reservations"))[0]!.id).toBe(local.refIds.reservation);
  });

  it("refuses requests that are not signed with the shared secret", () => {
    const gw = loadGateway("real-secret");
    const res = gw.post(request([]), "wrong-secret");
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(res.error).toMatch(/signature/i);
  });
});
