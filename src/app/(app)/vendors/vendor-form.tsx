"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, toast } from "@/components/ui";

export function AddVendorForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", category: "Workshop", phone: "", email: "", address: "", gst: "", preferred: false });

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save the vendor.");
      setBusy(false);
      return;
    }
    setForm({ name: "", category: "Workshop", phone: "", email: "", address: "", gst: "", preferred: false });
    setBusy(false);
    toast.success("Vendor saved");
    router.refresh();
  }

  return (
    <div className="card space-y-2 p-4">
      <h3 className="font-semibold">Add vendor</h3>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <Field label="Vendor name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Vendor category">
        <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
          {["Workshop", "Body shop", "Denting painting", "Electrical", "Tyres", "AC", "Detailing", "Accessories", "Insurance", "RTO agent", "Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Vendor phone"><input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
      <Field label="Vendor email"><input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.preferred} onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))} /> Preferred vendor</label>
      <button className="btn-primary w-full" disabled={busy || !form.name} onClick={submit}>{busy ? "Saving…" : "Add vendor"}</button>
    </div>
  );
}
