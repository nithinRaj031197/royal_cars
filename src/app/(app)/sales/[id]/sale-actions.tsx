"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Button, ConfirmDialog, Field } from "@/components/ui";
import { formatINR } from "@/lib/money";

export function PaymentForm({ saleId, balance }: { saleId: string; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({ date: todayDateOnly(), amount: "", method: "UPI", reference: "", notes: "" });

  async function submit() {
    setBusy(true);
    setError("");
    setOk("");
    // Client-generated idempotency key: retried submissions do not double-post.
    const idempotencyKey = `${saleId}-${form.date}-${form.amount}-${Date.now()}`;
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment", saleId, date: form.date, amount: form.amount, method: form.method, reference: form.reference, notes: form.notes, idempotencyKey })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Could not record the payment.");
      setBusy(false);
      return;
    }
    setOk(`Payment recorded. Balance now ₹${(j.balance / 100).toLocaleString("en-IN")}.`);
    setForm((f) => ({ ...f, amount: "", reference: "" }));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card space-y-2 p-4">
      <h3 className="font-semibold">Record payment</h3>
      <p className="text-xs text-slate-500">Balance due: ₹{(balance / 100).toLocaleString("en-IN")}</p>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {ok ? <p className="text-sm text-green-700" role="status">{ok}</p> : null}
      <Field label="Date"><input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      <Field label="Amount (₹)" required><input className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
      <Field label="Method" required>
        <select className="input" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
          {["Cash", "UPI", "NEFT/RTGS", "Cheque", "Card", "Other"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="Reference"><input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} /></Field>
      <button className="btn-primary w-full" disabled={busy || !form.amount} onClick={submit}>{busy ? "Recording…" : "Record payment"}</button>
    </div>
  );
}

const CHECKLIST_ITEMS = [
  { kind: "Final inspection", label: "Final inspection (pre-delivery inspection completed)", mandatory: true },
  { kind: "Promised repairs", label: "All promised repairs completed", mandatory: true },
  { kind: "Cleaning & preparation", label: "Vehicle cleaned and detailed", mandatory: true },
  { kind: "Keys & accessories", label: "Both keys and accessories handed over", mandatory: true },
  { kind: "Required documents", label: "RC, insurance and sale documents given", mandatory: true },
  { kind: "Payment review", label: "Payment review — balance settled or approved exception", mandatory: true },
  { kind: "Handover acknowledgement", label: "Customer acknowledgement recorded", mandatory: true }
];

export function DeliveryPanel({ saleId, balance, vehicleId }: { saleId: string; balance: number; vehicleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState(CHECKLIST_ITEMS.map((i) => ({ ...i, done: false, note: "" })));
  const [deliveryDate, setDeliveryDate] = useState(todayDateOnly());
  const [odometerKm, setOdometerKm] = useState("");
  const [instructions, setInstructions] = useState("");
  const [allowOutstanding, setAllowOutstanding] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sales/${saleId}/delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId,
        deliveryDate,
        odometerKm: odometerKm || "0",
        items,
        instructions,
        allowOutstandingBalance: allowOutstanding && balance > 0,
        exceptionReason
      })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not complete delivery.");
      setBusy(false);
      return;
    }
    router.push(`/inventory/${vehicleId}?tab=sale`);
  }

  return (
    <div className="card space-y-2 p-4">
      <h3 className="font-semibold">Complete delivery</h3>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <Field label="Delivery date" required><input className="input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
      <Field label="Odometer at delivery (km)" required><input className="input" type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} /></Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Checklist</legend>
        {items.map((it, idx) => (
          <label key={it.kind} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={it.done}
              className="mt-1"
              onChange={(e) => setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, done: e.target.checked } : x)))}
            />
            <span>{it.label}{it.mandatory ? " *" : ""}</span>
          </label>
        ))}
      </fieldset>
      <Field label="Customer instructions"><textarea className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
      {balance > 0 ? (
        <div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowOutstanding} onChange={(e) => setAllowOutstanding(e.target.checked)} />
            Deliver with outstanding balance (owner approval required)
          </label>
          {allowOutstanding ? (
            <input className="input mt-2" placeholder="Exception reason + approver" value={exceptionReason} onChange={(e) => setExceptionReason(e.target.value)} />
          ) : null}
        </div>
      ) : null}
      <button className="btn-primary w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Complete delivery"}</button>
    </div>
  );
}

export function CancelSaleButton({ saleId, balance }: { saleId: string; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sale-cancel", id: saleId, reason, refundAmount: 0, refundMethod: "UPI" })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not cancel the sale.");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="card space-y-2 border-red-200 p-4">
      <h3 className="font-semibold text-red-700">Cancel sale</h3>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <Field label="Reason" required><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      {balance > 0 ? <p className="text-xs text-slate-500">Record refund payments separately via a negative (Adjustment) payment after cancelling.</p> : null}
      <ConfirmDialog
        trigger={<Button variant="danger" className="w-full" disabled={busy || !reason} loading={busy} loadingText="Cancelling…">Cancel sale</Button>}
        title="Cancel this sale?"
        description={
          <>
            The sale is marked cancelled and the vehicle is released for sale again. Payments already recorded are
            kept and must be refunded separately — nothing is deleted.
            {balance > 0 ? <> A balance of {formatINR(balance)} is still outstanding.</> : null}
          </>
        }
        confirmLabel="Cancel sale"
        onConfirm={submit}
      />
    </div>
  );
}
