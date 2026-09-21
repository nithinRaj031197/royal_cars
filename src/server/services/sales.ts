import { getRepo } from "@/lib/repo";
import { WriteContext } from "@/lib/store/types";

import { newOperationId } from "@/lib/ids";
import { sumPaise } from "@/lib/money";
import { repoFor } from "@/lib/repo";
import { CriticalAction } from "@/lib/store/actions";
import { reservationInputSchema, saleInputSchema, salePaymentInputSchema } from "@/lib/form-schemas";
import type { ReservationInput, SaleInput, SalePaymentInput } from "@/lib/form-schemas";

// Schemas live in @/lib/form-schemas so forms and routes validate identically.
export { reservationInputSchema, saleInputSchema, salePaymentInputSchema };
export type { ReservationInput, SaleInput, SalePaymentInput };

/** ---------- Reservations ---------- */

/**
 * Creates a reservation as a serialized critical write: the availability
 * assertions and the writes run atomically under the lock, so competing
 * reservations for the same vehicle cannot both succeed.
 */
export async function createReservation(input: ReservationInput, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const vehicle = await store.get("Vehicles", input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  // Advisory pre-check for states a reservation can never apply to. Whether the
  // vehicle is already reserved or sold is decided by the asserts below, which
  // run under the serialization lock and are the authoritative check.
  const blockedStates = ["In acquisition pipeline", "Sold", "Delivered", "Archived"];
  if (blockedStates.includes(vehicle.lifecycleState ?? "")) {
    throw Object.assign(new Error("Vehicle is not available for reservation."), { status: 409 });
  }

  // Upsert customer outside the critical section (idempotent by phone).
  const { customer } = await (await import("./crm")).upsertCustomer(
    { name: input.customerName ?? "", phone: input.customerPhone ?? "" },
    { actor: ctx.actor, operationId }
  );

  const actions: CriticalAction[] = [
    {
      type: "assert",
      table: "Reservations",
      notExists: { field: "vehicleId", equals: vehicle.id, and: [{ field: "status", equals: "Active" }] },
      message: "This vehicle already has an active reservation.",
      status: 409
    },
    {
      type: "assert",
      table: "Sales",
      notExists: { field: "vehicleId", equals: vehicle.id, andNot: { field: "status", equals: "Cancelled" } },
      message: "This vehicle already has an active sale.",
      status: 409
    },
    {
      type: "create",
      table: "Reservations",
      as: "reservation",
      data: {
        reservationRef: `RES-${Date.now().toString(36).toUpperCase()}`,
        vehicleId: vehicle.id,
        customerId: customer.id,
        agreedPricePaise: String(input.agreedPrice),
        bookingAmountPaise: String(input.bookingAmount),
        bookingDate: input.bookingDate,
        expiresOn: input.expiresOn ?? "",
        terms: input.terms ?? "",
        notes: input.notes ?? "",
        status: "Active",
        cancelledReason: "",
        refundAmountPaise: "0",
        refundMethod: "",
        refundDate: "",
        convertedSaleId: ""
      }
    },
    {
      type: "update",
      table: "Vehicles",
      id: vehicle.id,
      expectedVersion: vehicle.version,
      data: { lifecycleState: "Reserved" }
    }
  ];

  const result = await store.runCritical(
    { operationId, kind: "reservation.create", entityType: "Reservations", entityId: vehicle.id, actor: ctx.actor },
    actions
  );

  const reservationId = result.refIds.reservation ?? "";
  await repo.logStatusChange({ actor: ctx.actor, operationId }, "Vehicles", vehicle.id, vehicle.lifecycleState ?? "", "Reserved");
  await repo.logActivity(ctx, "reservation.create", "Reservations", reservationId,
    `Reservation created for ${vehicle.stockRef ?? "vehicle"}`);
  const reservation = await store.get("Reservations", reservationId);
  if (!reservation) throw Object.assign(new Error("Reservation not found after creation"), { status: 500 });
  return { reservationId, reservation, customerId: customer.id };
}

export async function cancelReservation(reservationId: string, reason: string, refundAmount: number, refundMethod: string, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const r = await store.get("Reservations", reservationId);
  if (!r) throw Object.assign(new Error("Reservation not found"), { status: 404 });
  const booking = Number(r.bookingAmountPaise ?? "0");
  if (refundAmount > booking) {
    throw Object.assign(new Error("Refund cannot exceed the booking amount received."), { status: 400 });
  }
  const vehicleId = r.vehicleId ?? "";

  const actions: CriticalAction[] = [
    {
      type: "assert-field",
      table: "Reservations",
      id: reservationId,
      field: "status",
      equals: "Active",
      message: "Only active reservations can be cancelled.",
      status: 400
    },
    {
      type: "update",
      table: "Reservations",
      id: reservationId,
      expectedVersion: r.version,
      data: {
        status: "Cancelled",
        cancelledReason: reason,
        refundAmountPaise: String(refundAmount),
        refundMethod,
        refundDate: new Date().toISOString().slice(0, 10)
      }
    },
    {
      type: "update",
      table: "Vehicles",
      id: vehicleId,
      data: { lifecycleState: "In preparation" }
    }
  ];

  await store.runCritical(
    { operationId, kind: "reservation.cancel", entityType: "Reservations", entityId: reservationId, actor: ctx.actor },
    actions
  );
  await repo.logActivity(ctx, "reservation.cancel", "Reservations", reservationId,
    `Reservation cancelled: ${reason}. Refund ₹${(refundAmount / 100).toLocaleString("en-IN")}`);
  const updated = await store.get("Reservations", reservationId);
  if (!updated) throw Object.assign(new Error("Reservation not found after cancellation"), { status: 500 });
  return updated;
}

/** ---------- Sales ---------- */

export async function createSale(input: SaleInput, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const vehicle = await store.get("Vehicles", input.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  if (!["In preparation", "Ready for sale", "Reserved"].includes(vehicle.lifecycleState ?? "")) {
    throw Object.assign(new Error("Vehicle is not available for sale."), { status: 409 });
  }

  let customerId = "";
  let bookingTransfer: { amount: number; date: string; reference: string } | null = null;
  let reservationVersion: number | undefined;
  if (input.reservationId) {
    const r = await store.get("Reservations", input.reservationId);
    if (!r || r.status !== "Active") {
      throw Object.assign(new Error("Reservation is not active."), { status: 409 });
    }
    if (r.vehicleId !== input.vehicleId) {
      throw Object.assign(new Error("Reservation belongs to a different vehicle."), { status: 400 });
    }
    customerId = r.customerId ?? "";
    reservationVersion = r.version;
    if (Number(r.bookingAmountPaise ?? "0") > 0) {
      bookingTransfer = {
        amount: Number(r.bookingAmountPaise),
        date: r.bookingDate ?? input.saleDate,
        reference: r.reservationRef ?? ""
      };
    }
  }
  if (!customerId) {
    const { customer } = await (await import("./crm")).upsertCustomer(
      { name: input.customerName ?? "", phone: input.customerPhone ?? "" },
      { actor: ctx.actor, operationId }
    );
    customerId = customer.id;
  }

  const saleRef = `SAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  const actions: CriticalAction[] = [
    {
      type: "assert",
      table: "Sales",
      notExists: { field: "vehicleId", equals: input.vehicleId, andNot: { field: "status", equals: "Cancelled" } },
      message: "This vehicle already has an active sale.",
      status: 409
    },
    {
      type: "create",
      table: "Sales",
      as: "sale",
      data: {
        saleRef,
        vehicleId: input.vehicleId,
        customerId,
        salespersonId: ctx.actor,
        reservationId: input.reservationId ?? "",
        finalNetPricePaise: String(input.finalNetPrice),
        saleDate: input.saleDate,
        paymentTerms: input.paymentTerms ?? "",
        deliveryDate: "",
        status: "Booked",
        deliveryChecklistId: "",
        docsComplete: "FALSE",
        notes: input.notes ?? "",
        cancelReason: "",
        snapshotInvestmentPaise: "0",
        snapshotPurchasePaise: "0",
        snapshotRepairsPaise: "0",
        snapshotAccessoriesPaise: "0",
        snapshotOtherPaise: "0",
        snapshotGrossProfitPaise: "0",
        snapshotAt: ""
      }
    }
  ];

  if (bookingTransfer) {
    actions.push(
      {
        type: "create",
        table: "SalePayments",
        data: {
          paymentRef: `SP-BOOK-${Date.now().toString(36).toUpperCase()}`,
          saleId: "$ref:sale",
          reservationId: input.reservationId ?? "",
          vehicleId: input.vehicleId,
          customerId,
          date: bookingTransfer.date,
          kind: "Booking",
          amountPaise: String(bookingTransfer.amount),
          method: "Adjusted from booking",
          reference: bookingTransfer.reference,
          notes: "Booking amount transferred to sale balance",
          recordedBy: ctx.actor,
          voidedAt: "",
          voidReason: "",
          voidedBy: "",
          reversesPaymentId: ""
        }
      },
      {
        type: "update",
        table: "Reservations",
        id: input.reservationId ?? "",
        expectedVersion: reservationVersion,
        data: { status: "Converted" }
      }
    );
  }

  actions.push({
    type: "update",
    table: "Vehicles",
    id: input.vehicleId,
    expectedVersion: vehicle.version,
    data: { lifecycleState: "Sold", finalSalePricePaise: String(input.finalNetPrice) }
  });

  const result = await store.runCritical(
    { operationId, kind: "sale.create", entityType: "Sales", entityId: input.vehicleId, actor: ctx.actor, payload: input },
    actions
  );

  const saleId = result.refIds.sale ?? "";
  await repo.logStatusChange({ actor: ctx.actor, operationId }, "Vehicles", input.vehicleId, vehicle.lifecycleState ?? "", "Sold");
  await repo.logActivity(ctx, "sale.create", "Sales", saleId, `Sale ${saleRef} booked for ${vehicle.stockRef ?? "vehicle"}`);

  // Capture the financial snapshot at sale time (non-critical, additive).
  const { investmentBreakdown } = await import("./work");
  const inv = await investmentBreakdown(store, input.vehicleId);
  const sale = await store.get("Sales", saleId);
  if (sale) {
    await store.update("Sales", saleId, {
      snapshotInvestmentPaise: String(inv.total),
      snapshotPurchasePaise: String(inv.purchase),
      snapshotRepairsPaise: String(inv.repairs),
      snapshotAccessoriesPaise: String(inv.accessories),
      snapshotOtherPaise: String(inv.other),
      snapshotGrossProfitPaise: String(input.finalNetPrice - inv.total),
      snapshotAt: new Date().toISOString()
    }, sale.version, { actor: ctx.actor, operationId });
  }

  const saleRow = await store.get("Sales", saleId);
  if (!saleRow) throw Object.assign(new Error("Sale not found after creation"), { status: 500 });
  return { saleId, saleRef, sale: saleRow, customerId, investment: inv };
}

/** ---------- Payments ---------- */

export async function addSalePayment(input: SalePaymentInput, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  // Idempotency: an already-completed operation is not applied twice.
  const ops = await store.list("Operations", { activeOnly: false });
  if (ops.some((o) => o.id === operationId && o.status === "completed")) {
    throw Object.assign(new Error("This payment was already recorded."), { status: 409 });
  }

  const sale = await store.get("Sales", input.saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });
  if (sale.status === "Cancelled") throw Object.assign(new Error("Sale is cancelled."), { status: 400 });
  const price = Number(sale.finalNetPricePaise ?? "0");

  const payments = (await store.list("SalePayments", { activeOnly: true })).filter(
    (p) => p.saleId === input.saleId && !p.voidedAt
  );
  const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
  if (paid + input.amount > price) {
    throw Object.assign(
      new Error(`Payment exceeds the balance due (₹${((price - paid) / 100).toLocaleString("en-IN")} outstanding).`),
      { status: 400 }
    );
  }
  const kind = paid + input.amount >= price ? "Final payment" : input.kind ?? "Part payment";
  const newStatus = paid + input.amount >= price ? "Fully paid" : "Part paid";

  const actions: CriticalAction[] = [
    // The pre-check above gives the precise outstanding figure in the common
    // case; this re-checks the same rule while holding the lock, so two
    // simultaneous payments cannot each see the same stale total and both pass.
    {
      type: "assert-sum",
      table: "SalePayments",
      field: "amountPaise",
      where: [{ field: "saleId", equals: input.saleId }],
      excludeWhenSet: ["voidedAt"],
      plus: input.amount,
      notGreaterThan: price,
      message: "Payment exceeds the balance due for this sale.",
      status: 400
    },
    {
      type: "create",
      table: "SalePayments",
      data: {
        paymentRef: `SP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
        saleId: input.saleId,
        reservationId: sale.reservationId ?? "",
        vehicleId: sale.vehicleId ?? "",
        customerId: sale.customerId ?? "",
        date: input.date,
        kind,
        amountPaise: String(input.amount),
        method: input.method,
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        recordedBy: ctx.actor,
        voidedAt: "",
        voidReason: "",
        voidedBy: "",
        reversesPaymentId: ""
      }
    }
  ];
  if (["Booked", "Part paid"].includes(sale.status ?? "")) {
    actions.push({
      type: "update",
      table: "Sales",
      id: input.saleId,
      expectedVersion: sale.version,
      data: { status: newStatus }
    });
  }

  await store.runCritical(
    { operationId, kind: "sale.payment", entityType: "SalePayments", entityId: input.saleId, actor: ctx.actor, payload: input },
    actions
  );
  await repo.logActivity(ctx, "sale.payment", "SalePayments", input.saleId,
    `Payment ₹${(input.amount / 100).toLocaleString("en-IN")} (${input.method}) on ${sale.saleRef ?? ""}`);
  return { paid: paid + input.amount, balance: price - paid - input.amount, status: newStatus };
}

/** Void/reversal workflow — preserves the original record. */
export async function voidSalePayment(paymentId: string, reason: string, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const p = await store.get("SalePayments", paymentId);
  if (!p) throw Object.assign(new Error("Payment not found"), { status: 404 });

  const actions: CriticalAction[] = [
    {
      type: "assert-field",
      table: "SalePayments",
      id: paymentId,
      field: "voidedAt",
      equals: "",
      message: "Payment is already voided.",
      status: 400
    },
    {
      type: "update",
      table: "SalePayments",
      id: paymentId,
      expectedVersion: p.version,
      data: { voidedAt: new Date().toISOString(), voidReason: reason, voidedBy: ctx.actor }
    },
    {
      type: "create",
      table: "SalePayments",
      data: {
        paymentRef: `SP-REV-${Date.now().toString(36).toUpperCase()}`,
        saleId: p.saleId ?? "",
        reservationId: p.reservationId ?? "",
        vehicleId: p.vehicleId ?? "",
        customerId: p.customerId ?? "",
        date: new Date().toISOString().slice(0, 10),
        kind: "Adjustment",
        amountPaise: String(-Number(p.amountPaise ?? "0")),
        method: "Reversal",
        reference: p.paymentRef ?? "",
        notes: `Reversal of ${p.paymentRef}: ${reason}`,
        recordedBy: ctx.actor,
        voidedAt: "",
        voidReason: "",
        voidedBy: "",
        reversesPaymentId: paymentId
      }
    }
  ];

  await store.runCritical(
    { operationId, kind: "sale.payment.void", entityType: "SalePayments", entityId: paymentId, actor: ctx.actor },
    actions
  );
  await repo.logActivity(ctx, "sale.payment.void", "SalePayments", paymentId,
    `Payment ${p.paymentRef ?? ""} voided: ${reason}`);
  return { ok: true };
}

/** Cancels a sale (not yet delivered); preserves history and releases the vehicle. */
export async function cancelSale(saleId: string, reason: string, ctx: WriteContext) {
  const repo = getRepo();
  const store = repo.store;
  const operationId = ctx.operationId ?? newOperationId();

  const s = await store.get("Sales", saleId);
  if (!s) throw Object.assign(new Error("Sale not found"), { status: 404 });
  if (["Delivered", "Completed", "Cancelled"].includes(s.status ?? "")) {
    throw Object.assign(new Error("A delivered or already cancelled sale cannot be cancelled."), { status: 400 });
  }

  const actions: CriticalAction[] = [
    {
      type: "update",
      table: "Sales",
      id: saleId,
      expectedVersion: s.version,
      data: { status: "Cancelled", cancelReason: reason }
    },
    {
      type: "update",
      table: "Vehicles",
      id: s.vehicleId ?? "",
      data: { lifecycleState: "Ready for sale" }
    }
  ];

  await store.runCritical(
    { operationId, kind: "sale.cancel", entityType: "Sales", entityId: saleId, actor: ctx.actor },
    actions
  );
  await repo.logStatusChange({ actor: ctx.actor, operationId }, "Vehicles", s.vehicleId ?? "", "Sold", "Ready for sale", `Sale cancelled: ${reason}`);
  await repo.logActivity(ctx, "sale.cancel", "Sales", saleId,
    `Sale ${s.saleRef ?? ""} cancelled: ${reason}. Refunds must be recorded as Adjustment payments.`);
  return { ok: true };
}

/** Balances computed from valid payment records (voided excluded, refunds negative). */
export async function saleBalances(store: import("@/lib/store/types").DataStore, saleId: string) {
  const repo = repoFor(store);
  const sale = await repo.table("Sales").get(saleId);
  if (!sale) throw Object.assign(new Error("Sale not found"), { status: 404 });
  const payments = (await repo.table("SalePayments").list()).filter((p) => p.saleId === saleId && !p.voidedAt);
  const paid = sumPaise(payments.map((p) => Number(p.amountPaise ?? "0")));
  const price = Number(sale.finalNetPricePaise ?? "0");
  return { price, paid, balance: price - paid, payments };
}
