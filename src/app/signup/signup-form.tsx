"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  sales: "Sales",
  operations: "Operations",
  accounts: "Accounts"
};

export function SignupForm() {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "sales" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Could not submit the request.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          Request submitted. An owner needs to approve your account from
          Settings before you can sign in.
        </div>
        <Link href="/login" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Field label="Name" help={false}>
        <input
          className="input"
          autoComplete="name"
          autoFocus
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </Field>

      <Field label="Email" help={false}>
        <input
          className="input"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="you@royalcars.in"
        />
      </Field>

      <Field label="Password" help={false}>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
      </Field>

      <Field
        label="Which team?"
        hint="An owner can change this when approving your request."
        help={false}
      >
        <select
          className="input"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Button
        type="submit"
        className="w-full"
        loading={busy}
        loadingText="Submitting…"
        disabled={!form.email || !form.name || !form.password}
      >
        Request account
      </Button>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        Already have an approved account?{" "}
        <Link href="/login" className="font-medium text-slate-700 hover:text-slate-900">
          Sign in
        </Link>
      </p>
    </form>
  );
}
