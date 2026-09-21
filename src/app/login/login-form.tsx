"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Field } from "@/components/ui";

/**
 * Staff sign-in: email and password, checked against the Staff tab.
 *
 * The form deliberately gives one message for every kind of failure. Saying
 * "no such account" would let anyone use this page to discover which addresses
 * belong to staff; the server decides, and simply reports that the combination
 * is wrong.
 */
export function LoginForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await signIn("password", { email: email.trim(), password, redirect: false });
      if (res?.error) {
        setError(res.error === "CredentialsSignin" ? "Email or password is incorrect." : res.error);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <Field label="Email" help={false}>
        <input
          className="input"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@royalcars.in"
        />
      </Field>

      <Field label="Password" help={false}>
        <div className="relative">
          <input
            className="input pr-16"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-slate-900"
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      <Button type="submit" className="w-full" loading={busy} loadingText="Signing in…">
        Sign in
      </Button>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        Accounts are created by an owner — there is no self sign-up. If you have
        forgotten your password, ask an owner to set a new one.
      </p>

      {demo ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          Demo data. Sign in as <span className="font-medium text-slate-700">owner@royalcars.demo</span> with the
          password printed by <code className="font-mono">pnpm sheets:seed</code>.
        </p>
      ) : null}
    </form>
  );
}
