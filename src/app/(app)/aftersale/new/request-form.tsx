"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Field, toast } from "@/components/ui";

export function ServiceRequestForm({ sales }: { sales: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    saleId: "",
    complaint: "",
    reportedDate: todayDateOnly(),
    odometerKm: "",
    priority: "Normal",
    appointmentAt: "",
    notes: ""
  });

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/aftersale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "request", ...form, odometerKm: form.odometerKm || undefined })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save the request.");
      setBusy(false);
      return;
    }
    const j = await res.json();
    toast.success("Service request raised");
    router.push(`/aftersale/${j.id}`);
  }

  return (
    <div className="card max-w-2xl space-y-3 p-4">
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <Field label="Sale" required>
        <select className="input" value={form.saleId} onChange={(e) => setForm((f) => ({ ...f, saleId: e.target.value }))}>
          <option value="">Choose sale…</option>
          {sales.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Complaint" required><textarea className="input" rows={3} value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Reported date" required><input className="input" type="date" value={form.reportedDate} onChange={(e) => setForm((f) => ({ ...f, reportedDate: e.target.value }))} /></Field>
        <Field label="Odometer (km)"><input className="input" type="number" value={form.odometerKm} onChange={(e) => setForm((f) => ({ ...f, odometerKm: e.target.value }))} /></Field>
        <Field label="Priority" required>
          <select className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            {["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Appointment"><input className="input" type="datetime-local" value={form.appointmentAt} onChange={(e) => setForm((f) => ({ ...f, appointmentAt: e.target.value }))} /></Field>
      </div>
      <button className="btn-primary" disabled={busy || !form.saleId} onClick={submit}>{busy ? "Saving…" : "Raise request"}</button>
    </div>
  );
}
