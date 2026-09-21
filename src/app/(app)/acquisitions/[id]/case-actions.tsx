"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dates";
import { Button, ConfirmDialog, Field, toast } from "@/components/ui";

const NEXT_STATUS = ["Inspection scheduled", "Evaluated", "Negotiating"] as const;

export function CaseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusTo, setStatusTo] = useState("");
  const [agreed, setAgreed] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayDateOnly());
  const [reason, setReason] = useState("");

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/acquisitions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Action failed.");
      setBusy(false);
      return;
    }
    setBusy(false);
    toast.success("Acquisition case updated");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="font-semibold">Pipeline actions</h2>
      {error ? <p className="error-text" role="alert">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {NEXT_STATUS.map((s) => (
          <button key={s} className="btn-secondary" disabled={busy} onClick={() => setStatusTo(statusTo === s ? "" : s)}>
            {s}
          </button>
        ))}
      </div>
      {statusTo ? (
        <div className="space-y-2">
          <Field label="Note / reason">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={busy} onClick={() => act({ action: "status", status: statusTo, reason }).then(() => setStatusTo(""))}>
            Apply “{statusTo}”
          </button>
        </div>
      ) : null}

      <hr className="border-slate-200" />

      <Field label="Agree purchase price (₹) — marks case Approved">
        <input className="input" inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value)} placeholder="e.g. 350000" />
      </Field>
      <button
        className="btn-primary"
        disabled={busy || !agreed}
        onClick={() => act({ action: "approve", agreedPrice: agreed })}
      >
        Approve at this price
      </button>

      {status === "Approved" || status === "Acquired" ? (
        <>
          <hr className="border-slate-200" />
          <p className="text-sm text-slate-600">Record vehicle receipt (marks the case Acquired):</p>
          <Field label="Actual purchase price (₹)">
            <input className="input" inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </Field>
          <Field label="Purchase / receiving date">
            <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <button
            className="btn-primary"
            disabled={busy || !purchasePrice || !purchaseDate}
            onClick={() => act({ action: "acquire", purchasePrice, purchaseDate })}
          >
            Mark acquired & received
          </button>
        </>
      ) : null}

      <hr className="border-slate-200" />
      <Field label="Reject / cancel reason">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          trigger={<Button variant="danger" disabled={busy || !reason}>Reject enquiry</Button>}
          title="Reject this enquiry?"
          description={
            <>
              The enquiry leaves the pipeline but stays searchable, so you can still answer the seller later.
              The reason recorded is: <span className="font-medium text-slate-900">{reason || "—"}</span>
            </>
          }
          confirmLabel="Reject enquiry"
          onConfirm={() => act({ action: "reject", reason })}
        />
        <ConfirmDialog
          trigger={<Button variant="secondary" disabled={busy || !reason}>Cancel case</Button>}
          title="Cancel this case?"
          description="The vehicle will not enter inventory. Nothing recorded so far is deleted."
          confirmLabel="Cancel case"
          onConfirm={() => act({ action: "cancel", reason })}
        />
      </div>
    </div>
  );
}
