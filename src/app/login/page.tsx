import { existsSync } from "node:fs";
import path from "node:path";
import { envConfig } from "@/lib/config/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Photographs are optional: the panel has a designed fallback without them. */
function findArtwork(): string | null {
  for (const name of ["car-1.jpg", "car-1.jpeg", "car-1.webp", "car-1.png"]) {
    if (existsSync(path.join(process.cwd(), "public", "images", "login", name))) {
      return `/images/login/${name}`;
    }
  }
  return null;
}

export default function LoginPage() {
  const demo = envConfig.demoMode;
  const artwork = findArtwork();

  return (
    <main className="flex min-h-screen bg-ink-950">
      {/* Brand panel. Hidden on phones, where it would push the form below the
          fold — the point of this screen is to sign in, not to admire it. */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-950 p-10 lg:flex xl:w-[55%]">
        {artwork ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artwork} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-tr from-ink-950 via-ink-950/85 to-ink-900/40" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0">
            <div className="absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-brand-600/25 blur-3xl" />
            <div className="absolute -bottom-32 right-0 h-[24rem] w-[24rem] rounded-full bg-brand-800/25 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "56px 56px"
              }}
            />
          </div>
        )}

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/30">
            RC
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-white">Royal Cars</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Every car, every rupee — seller to customer.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Track a vehicle from the first seller enquiry through inspection, refurbishment and sale, with the full
            cost trail behind it.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
            {[
              ["Buying", "Enquiries & purchase"],
              ["Preparing", "Work & costs"],
              ["Selling", "Sales & delivery"]
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="text-sm font-medium text-white">{term}</dt>
                <dd className="mt-0.5 text-xs text-slate-500">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-slate-600">Authorised staff only.</p>
      </section>

      {/* Sign-in panel */}
      <section className="flex w-full flex-col justify-center bg-slate-50 px-5 py-10 sm:px-10 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              RC
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-slate-900">Royal Cars</span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Use the email and password your owner set up for you.</p>

          <LoginForm demo={demo} />
        </div>
      </section>
    </main>
  );
}
