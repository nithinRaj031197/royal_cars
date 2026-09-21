import { envConfig } from "@/lib/config/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // Resolved on the server: the UI can only ever offer a provider that exists.
  const demo = envConfig.demoMode;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">Royal Cars</h1>
        <p className="mt-1 text-sm text-slate-500">
          Staff sign-in. Access is limited to approved accounts.
        </p>
        <LoginForm demo={demo} />
      </div>
    </main>
  );
}
