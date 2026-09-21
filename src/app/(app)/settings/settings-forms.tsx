"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, toast } from "@/components/ui";

export function SettingsForm({ initial, disabled }: { initial: Record<string, string>; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const get = (k: string) => initial[`showroom:${k}`] ?? "";
  const [form, setForm] = useState({
    showroomName: get("showroomName"),
    tagline: get("tagline"),
    phone: get("phone"),
    whatsapp: get("whatsapp"),
    email: get("email"),
    address: get("address"),
    currency: get("currency") || "INR",
    timezone: get("timezone") || "Asia/Kolkata",
    odometerUnit: get("odometerUnit") || "km",
    serviceDefaults: get("serviceDefaults"),
    publicContactNote: get("publicContactNote")
  });

  async function submit() {
    setBusy(true); setError(""); setMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save settings.");
    } else {
      setMsg("Settings saved.");
    }
    setBusy(false);
    toast.success("Showroom settings saved");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="font-semibold">Showroom identity</h2>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {msg ? <p className="text-sm text-green-700" role="status">{msg}</p> : null}
      <Field label="Showroom name" required><input className="input" value={form.showroomName} onChange={(e) => setForm((f) => ({ ...f, showroomName: e.target.value }))} /></Field>
      <Field label="Tagline"><input className="input" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Showroom phone"><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
        <Field label="WhatsApp"><input className="input" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></Field>
        <Field label="Showroom email"><input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
        <Field label="Currency"><input className="input" value={form.currency} disabled /></Field>
        <Field label="Timezone"><input className="input" value={form.timezone} disabled /></Field>
        <Field label="Odometer unit"><input className="input" value={form.odometerUnit} disabled /></Field>
      </div>
      <Field label="Address"><textarea className="input" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
      <Field label="Service defaults"><textarea className="input" rows={2} value={form.serviceDefaults} onChange={(e) => setForm((f) => ({ ...f, serviceDefaults: e.target.value }))} /></Field>
      <button className="btn-primary" disabled={disabled || busy} onClick={submit}>{busy ? "Saving…" : "Save settings"}</button>
      {disabled ? <p className="text-xs text-slate-500">You need settings permission to edit.</p> : null}
    </div>
  );
}

export function StaffForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", name: "", role: "sales", phone: "", active: true });

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch("/api/settings/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not save staff.");
    } else {
      setForm({ email: "", name: "", role: "sales", phone: "", active: true });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
      <h3 className="font-medium">Add / update staff</h3>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Staff email" required><input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
        <Field label="Staff name" required><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Role" required>
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="owner">Owner / Admin</option>
            <option value="sales">Sales</option>
            <option value="operations">Operations</option>
            <option value="accounts">Accounts</option>
          </select>
        </Field>
        <Field label="Staff phone"><input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active (may sign in)</label>
      <button className="btn-primary" disabled={busy || !form.email || !form.name} onClick={submit}>{busy ? "Saving…" : "Save staff"}</button>
    </div>
  );
}

export function ImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [entity, setEntity] = useState("Vehicles");
  const [mode, setMode] = useState("upsert");
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true); setError(""); setResult("");
    const text = await file.text();
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, mode, csv: text })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setError(j.error ?? "Import failed.");
    else {
      setResult(`Created ${j.created}, updated ${j.updated}, errors ${j.errors?.length ?? 0}.`);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Entity">
          <select className="input" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {["Vehicles", "Customers", "Vendors", "Expenses"].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Field>
        <Field label="Mode">
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="upsert">Create or update</option>
            <option value="create-only">Create only</option>
          </select>
        </Field>
      </div>
      <input className="input" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="CSV file" />
      <button className="btn-primary" disabled={busy || !file} onClick={submit}>{busy ? "Importing…" : "Import CSV"}</button>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {result ? <p className="text-sm text-green-700" role="status">{result}</p> : null}
    </div>
  );
}

export function ReconcileButton() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState("");

  async function run() {
    setBusy(true); setError(""); setReport("");
    const res = await fetch("/api/reconcile", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setError(j.error ?? "Reconciliation failed.");
    else setReport(JSON.stringify(j.issues, null, 2) || "No issues found.");
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <h2 className="mb-2 font-semibold">Data reconciliation</h2>
      <p className="mb-2 text-xs text-slate-500">Read-only check for duplicate IDs, broken references and incomplete operations. Run after manual sheet edits.</p>
      <button className="btn-secondary" disabled={busy} onClick={run}>{busy ? "Checking…" : "Run reconciliation"}</button>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {report ? <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">{report}</pre> : null}
    </div>
  );
}
