import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen bg-ink-950">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-950 p-10 lg:flex xl:w-[55%]">
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

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/30">
            RC
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-white">Royal Cars</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Request an account.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            An owner reviews every request before it can sign in — this creates a
            pending account, not an active one.
          </p>
        </div>

        <p className="relative text-xs text-slate-600">Authorised staff only.</p>
      </section>

      <section className="flex w-full flex-col justify-center bg-slate-50 px-5 py-10 sm:px-10 lg:w-1/2 xl:w-[45%]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              RC
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-slate-900">Royal Cars</span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Request an account</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            An owner must approve this before you can sign in.
          </p>

          <SignupForm />
        </div>
      </section>
    </main>
  );
}
