"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Field, toast } from "@/components/ui";

export function NewSaleForm({
  kind, vehicles, reservations
}: {
  kind: "reservation" | "sale";
  vehicles: Array<{ id: string; label: string }>;
  reservations: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = todayDateOnly();
  const [form, setForm] = useState({
    vehicleId: "",
    customerName: "",
    customerPhone: "",
    reservationId: "",
    agreedPrice: "",
    bookingAmount: "",
    bookingDate: today,
    expiresOn: "",
    finalNetPrice: "",
    saleDate: today,
    paymentTerms: "",
    notes: ""
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = kind === "reservation"
      ? {
          type: "reservation",
          vehicleId: form.vehicleId,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          agreedPrice: form.agreedPrice,
          bookingAmount: form.bookingAmount,
          bookingDate: form.bookingDate,
          expiresOn: form.expiresOn || form.bookingDate,
          terms: form.paymentTerms,
          notes: form.notes
        }
      : {
          type: "sale",
          vehicleId: form.vehicleId,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          reservationId: form.reservationId,
          finalNetPrice: form.finalNetPrice,
          saleDate: form.saleDate,
          paymentTerms: form.paymentTerms,
          notes: form.notes
        };
    const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      setBusy(false);
      return;
    }
    toast.success("Sale recorded");
    router.push("/sales");
  }

  return (
    <div className="card max-w-2xl space-y-3 p-4">
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <Field label="Vehicle" required>
        <select className="input" value={form.vehicleId} onChange={(e) => set("vehicleId", e.target.value)}>
          <option value="">Choose vehicle…</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name" required><input className="input" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></Field>
        <Field label="Customer phone" required><input className="input" inputMode="tel" value={form.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} /></Field>
      </div>

      {kind === "reservation" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agreed price (₹)" required><input className="input" inputMode="decimal" value={form.agreedPrice} onChange={(e) => set("agreedPrice", e.target.value)} /></Field>
            <Field label="Booking amount (₹)" required><input className="input" inputMode="decimal" value={form.bookingAmount} onChange={(e) => set("bookingAmount", e.target.value)} /></Field>
            <Field label="Booking date" required><input className="input" type="date" value={form.bookingDate} onChange={(e) => set("bookingDate", e.target.value)} /></Field>
            <Field label="Expires on"><input className="input" type="date" value={form.expiresOn} onChange={(e) => set("expiresOn", e.target.value)} /></Field>
          </div>
          <Field label="Terms"><textarea className="input" rows={2} value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
        </>
      ) : (
        <>
          <Field label="Convert from reservation">
            <select className="input" value={form.reservationId} onChange={(e) => set("reservationId", e.target.value)}>
              <option value="">None (direct sale)</option>
              {reservations.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Final net price (₹)" required><input className="input" inputMode="decimal" value={form.finalNetPrice} onChange={(e) => set("finalNetPrice", e.target.value)} /></Field>
            <Field label="Sale date" required><input className="input" type="date" value={form.saleDate} onChange={(e) => set("saleDate", e.target.value)} /></Field>
          </div>
          <Field label="Payment terms"><textarea className="input" rows={2} value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></Field>
        </>
      )}
      <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <button className="btn-primary" disabled={busy || !form.vehicleId} onClick={submit}>{busy ? "Saving…" : kind === "reservation" ? "Create reservation" : "Book sale"}</button>
    </div>
  );
}
