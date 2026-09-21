"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, toast } from "@/components/ui";

export function LeadForm({ customers, vehicles }: { customers: Array<{ id: string; label: string }>; vehicles: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    newCustomer: false,
    name: "",
    phone: "",
    vehicleId: "",
    source: "Walk-in",
    budget: "",
    notes: "",
    followUpDate: ""
  });

  async function submit() {
    setBusy(true);
    setError("");
    let customerId = form.customerId;
    if (form.newCustomer) {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "customer", name: form.name, phone: form.phone })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not save the customer.");
        setBusy(false);
        return;
      }
      const j = await res.json();
      customerId = j.id;
    }
    const res = await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lead", customerId, vehicleId: form.vehicleId, source: form.source, budget: form.budget || undefined, notes: form.notes })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save the lead.");
      setBusy(false);
      return;
    }
    toast.success("Lead created");
    router.push("/leads");
  }

  return (
    <div className="card max-w-2xl space-y-3 p-4">
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.newCustomer} onChange={(e) => setForm((f) => ({ ...f, newCustomer: e.target.checked }))} />
        New customer
      </label>
      {form.newCustomer ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Customer phone" required><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
        </div>
      ) : (
        <Field label="Customer" required>
          <select className="input" value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
            <option value="">Choose customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="Interested vehicle">
        <select className="input" value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}>
          <option value="">Any</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source" required>
          <select className="input" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
            {["Walk-in", "Phone", "Website", "Referral", "Social media", "Newspaper", "OLX/Portals", "Other"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Budget (₹)"><input className="input" inputMode="decimal" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} /></Field>
      </div>
      <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
      <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Create lead"}</button>
    </div>
  );
}
