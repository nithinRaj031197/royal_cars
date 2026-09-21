"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const DEMO_PROFILES = [
  { email: "owner@royalcars.demo", role: "owner", label: "Owner / Admin" },
  { email: "sales@royalcars.demo", role: "sales", label: "Sales" },
  { email: "ops@royalcars.demo", role: "operations", label: "Operations" },
  { email: "accounts@royalcars.demo", role: "accounts", label: "Accounts" }
];

/**
 * `demo` is resolved on the server from DEMO_MODE and passed in, so the sign-in
 * options shown always match the providers the server actually registered.
 * (Reading a NEXT_PUBLIC_* copy here meant the two could disagree — and did:
 * demo mode offered a Google button that demo mode has no provider for.)
 */
export function LoginForm({ demo }: { demo: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loginDemo(profile: (typeof DEMO_PROFILES)[number]) {
    setBusy(profile.email);
    setError("");
    try {
      const res = await signIn("demo", { email: profile.email, role: profile.role, redirect: false });
      if (res?.error) setError("Sign-in failed. Please try again.");
      else window.location.href = "/";
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (demo) {
    return (
      <div className="mt-6">
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        <p className="mb-2 text-sm font-medium text-slate-700">Demo mode — choose a staff profile</p>
        <div className="grid gap-2">
          {DEMO_PROFILES.map((p) => (
            <button
              key={p.email}
              className="btn-secondary w-full flex-col items-start gap-0 text-left sm:flex-row sm:items-center sm:justify-between"
              disabled={busy !== null}
              onClick={() => loginDemo(p)}
            >
              <span className="font-medium">{busy === p.email ? "Signing in…" : p.label}</span>
              <span className="text-xs text-slate-500">{p.email}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Demo data is fictional and kept separate from any production Google Sheet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <button
        className="btn-primary w-full"
        disabled={busy !== null}
        onClick={() => {
          setBusy("google");
          signIn("google", { callbackUrl: "/" });
        }}
      >
        {busy ? "Signing in…" : "Continue with Google"}
      </button>
      <p className="mt-3 text-xs text-slate-500">
        Only email addresses on the staff allowlist can sign in. Ask an owner to add you in Settings → Staff.
      </p>
    </div>
  );
}
