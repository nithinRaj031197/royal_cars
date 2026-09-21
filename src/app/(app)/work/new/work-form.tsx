"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Field } from "@/components/ui";

type EntryType = "work" | "accessory" | "expense";

export function WorkEntryForm({
  type, vehicles, vendors, initialVehicleId
}: {
  type: EntryType;
  vehicles: Array<{ id: string; label: string }>;
  vendors: Array<{ id: string; label: string }>;
  initialVehicleId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    vehicleId: initialVehicleId,
    stage: "Inventory preparation",
    issue: "",
    requiredWork: "",
    category: "General",
    vendorId: "",
    estimated: "",
    startDate: "",
    expectedCompletionDate: "",
    odometerKm: "",
    payer: "Showroom",
    linkedWorkOrderRef: "",
    // accessory
    item: "",
    quantity: "1",
    unitCost: "",
    installedOn: "",
    required: false,
    workOrderId: "",
    notes: "",
    // expense
    expenseCategory: "Transportation",
    date: todayDateOnly(),
    amount: "",
    reference: ""
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = { type };
    if (type === "work") {
      Object.assign(payload, {
        vehicleId: form.vehicleId,
        stage: form.stage,
        issue: form.issue,
        requiredWork: form.requiredWork,
        category: form.category,
        vendorId: form.vendorId,
        estimated: form.estimated,
        startDate: form.startDate,
        expectedCompletionDate: form.expectedCompletionDate,
        odometerKm: form.odometerKm || undefined,
        payer: form.payer,
        linkedWorkOrderRef: form.linkedWorkOrderRef
      });
    } else if (type === "accessory") {
      Object.assign(payload, {
        vehicleId: form.vehicleId,
        item: form.item,
        quantity: form.quantity,
        unitCost: form.unitCost,
        vendorId: form.vendorId,
        installedOn: form.installedOn,
        required: form.required,
        workOrderId: form.workOrderId,
        payer: form.payer,
        notes: form.notes
      });
    } else {
      Object.assign(payload, {
        vehicleId: form.vehicleId,
        category: form.expenseCategory,
        date: form.date,
        amount: form.amount,
        payer: form.payer,
        vendorId: form.vendorId,
        reference: form.reference,
        notes: form.notes
      });
    }
    const res = await fetch("/api/work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save.");
      setBusy(false);
      return;
    }
    router.push(`/inventory/${form.vehicleId}?tab=work`);
  }

  const vehicleField = (
    <Field label="Vehicle" required>
      <select className="input" value={form.vehicleId} onChange={(e) => set("vehicleId", e.target.value)}>
        <option value="">Choose vehicle…</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </Field>
  );
  const payerField = (
    <Field label="Payer" required>
      <select className="input" value={form.payer} onChange={(e) => set("payer", e.target.value)}>
        {["Showroom", "Seller", "Customer", "Other"].map((p) => <option key={p}>{p}</option>)}
      </select>
    </Field>
  );
  const vendorField = (
    <Field label="Vendor / workshop">
      <select className="input" value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
        <option value="">—</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="card max-w-3xl space-y-3 p-4">
      {error ? <p className="error-text" role="alert">{error}</p> : null}

      {type === "work" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {vehicleField}
            <Field label="Stage" required>
              <select className="input" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                {["Pre-purchase", "Inventory preparation", "Pre-delivery", "After-sale"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Issue">
              <input className="input" value={form.issue} onChange={(e) => set("issue", e.target.value)} />
            </Field>
            <Field label="Required work">
              <input className="input" value={form.requiredWork} onChange={(e) => set("requiredWork", e.target.value)} />
            </Field>
            <Field label="Work category">
              <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} />
            </Field>
            {vendorField}
            <Field label="Estimated cost (₹)">
              <input className="input" inputMode="decimal" value={form.estimated} onChange={(e) => set("estimated", e.target.value)} />
            </Field>
            <Field label="Start date"><input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="Expected completion"><input className="input" type="date" value={form.expectedCompletionDate} onChange={(e) => set("expectedCompletionDate", e.target.value)} /></Field>
            <Field label="Odometer (km)"><input className="input" type="number" value={form.odometerKm} onChange={(e) => set("odometerKm", e.target.value)} /></Field>
            {payerField}
            <Field label="Linked follow-up WO ref"><input className="input" value={form.linkedWorkOrderRef} onChange={(e) => set("linkedWorkOrderRef", e.target.value)} /></Field>
          </div>
        </>
      ) : null}

      {type === "accessory" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicleField}
          <Field label="Item"><input className="input" value={form.item} onChange={(e) => set("item", e.target.value)} /></Field>
          <Field label="Quantity" required><input className="input" type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} /></Field>
          <Field label="Unit cost (₹)" required><input className="input" inputMode="decimal" value={form.unitCost} onChange={(e) => set("unitCost", e.target.value)} /></Field>
          {vendorField}
          <Field label="Installed on"><input className="input" type="date" value={form.installedOn} onChange={(e) => set("installedOn", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.required} onChange={(e) => set("required", e.target.checked)} /> Required</label>
          <Field label="Included in work order">
            <input className="input" placeholder="WO ref if billed inside a work order" value={form.workOrderId} onChange={(e) => set("workOrderId", e.target.value)} />
          </Field>
          {payerField}
          <Field label="Accessory notes"><input className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      ) : null}

      {type === "expense" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicleField}
          <Field label="Expense category" required>
            <select className="input" value={form.expenseCategory} onChange={(e) => set("expenseCategory", e.target.value)}>
              {["Transportation", "Insurance", "Documentation", "Parking", "Advertising", "Inspection fee", "Accessories", "Repair", "Miscellaneous"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Date" required><input className="input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Amount (₹)" required><input className="input" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
          {payerField}
          {vendorField}
          <Field label="Reference"><input className="input" value={form.reference} onChange={(e) => set("reference", e.target.value)} /></Field>
          <Field label="Expense notes"><input className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !form.vehicleId} onClick={submit}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Canonical cost rules: work-order actuals count once; accessories linked to a work order are not counted again;
        customer-paid work is excluded from investment.
      </p>
    </div>
  );
}
