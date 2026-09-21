"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Field, toast } from "@/components/ui";

export function ServiceRequestActions({ id, status, coverage }: { id: string; status: string; coverage: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coverageDecision, setCoverageDecision] = useState("");
  const [coverageReason, setCoverageReason] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [job, setJob] = useState({ date: todayDateOnly(), workDone: "", diagnosis: "", parts: "", labour: "" });
  const [completionNotes, setCompletionNotes] = useState("");
  const [charge, setCharge] = useState({ amount: "", method: "UPI", reference: "" });
  const [reopenReason, setReopenReason] = useState("");

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/aftersale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Action failed.");
      setBusy(false);
      return;
    }
    setBusy(false);
    toast.success("Service request updated");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-semibold">Actions</h3>
      {error ? <p className="error-text" role="alert">{error}</p> : null}

      {coverage === "Pending" ? (
        <>
          <Field label="Coverage decision" required>
            <select className="input" value={coverageDecision} onChange={(e) => setCoverageDecision(e.target.value)}>
              <option value="">Choose…</option>
              <option value="Covered">Covered (showroom pays)</option>
              <option value="Customer billable">Customer billable</option>
            </select>
          </Field>
          <Field label="Reason" required><input className="input" value={coverageReason} onChange={(e) => setCoverageReason(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy || !coverageDecision || !coverageReason}
            onClick={() => act({ type: "coverage", id, decision: coverageDecision, reason: coverageReason })}>
            Save coverage decision
          </button>
          <hr className="border-slate-200" />
        </>
      ) : null}

      {status === "Open" ? (
        <>
          <Field label="Schedule appointment"><input className="input" type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} /></Field>
          <button className="btn-secondary" disabled={busy || !appointmentAt} onClick={() => act({ type: "schedule", id, appointmentAt })}>Schedule</button>
          <hr className="border-slate-200" />
        </>
      ) : null}

      {!["Resolved", "Closed", "Cancelled"].includes(status) && coverage !== "Pending" ? (
        <>
          <p className="text-sm font-medium">Record service job</p>
          <Field label="Date"><input className="input" type="date" value={job.date} onChange={(e) => setJob((j) => ({ ...j, date: e.target.value }))} /></Field>
          <Field label="Work done" required><input className="input" value={job.workDone} onChange={(e) => setJob((j) => ({ ...j, workDone: e.target.value }))} /></Field>
          <Field label="Diagnosis"><input className="input" value={job.diagnosis} onChange={(e) => setJob((j) => ({ ...j, diagnosis: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Parts (₹)"><input className="input" inputMode="decimal" value={job.parts} onChange={(e) => setJob((j) => ({ ...j, parts: e.target.value }))} /></Field>
            <Field label="Labour (₹)"><input className="input" inputMode="decimal" value={job.labour} onChange={(e) => setJob((j) => ({ ...j, labour: e.target.value }))} /></Field>
          </div>
          <button className="btn-primary" disabled={busy || !job.workDone} onClick={() => act({ type: "job", serviceRequestId: id, ...job })}>Save job</button>
          <hr className="border-slate-200" />
        </>
      ) : null}

      {coverage === "Customer billable" ? (
        <>
          <p className="text-sm font-medium">Collect customer charge</p>
          <Field label="Amount (₹)" required><input className="input" inputMode="decimal" value={charge.amount} onChange={(e) => setCharge((c) => ({ ...c, amount: e.target.value }))} /></Field>
          <Field label="Method">
            <select className="input" value={charge.method} onChange={(e) => setCharge((c) => ({ ...c, method: e.target.value }))}>
              {["Cash", "UPI", "NEFT/RTGS", "Cheque", "Card", "Other"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Reference"><input className="input" value={charge.reference} onChange={(e) => setCharge((c) => ({ ...c, reference: e.target.value }))} /></Field>
          <button className="btn-primary" disabled={busy || !charge.amount} onClick={() => act({ type: "charge", serviceRequestId: id, date: todayDateOnly(), kind: "Charge", amount: charge.amount, method: charge.method, reference: charge.reference })}>
            Record charge
          </button>
          <hr className="border-slate-200" />
        </>
      ) : null}

      {status === "In progress" ? (
        <>
          <Field label="Completion notes" required><textarea className="input" rows={2} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} /></Field>
          <button className="btn-primary" disabled={busy} onClick={() => act({ type: "resolve", id, completionNotes })}>Mark resolved</button>
        </>
      ) : null}

      {status === "Resolved" ? (
        <button className="btn-secondary" disabled={busy} onClick={() => act({ type: "close", id })}>Close request</button>
      ) : null}

      {["Resolved", "Closed"].includes(status) ? (
        <>
          <Field label="Reopen reason" required><input className="input" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} /></Field>
          <button className="btn-danger" disabled={busy || !reopenReason} onClick={() => act({ type: "reopen", id, reason: reopenReason })}>Reopen</button>
        </>
      ) : null}
    </div>
  );
}
