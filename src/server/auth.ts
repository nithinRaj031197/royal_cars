import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import CredentialsProvider from "next-auth/providers/credentials";
import { ROLE_PERMISSIONS, isRole, Role } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: { id?: string; email?: string; name?: string; role?: Role };
  }
  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    staffId?: string;
  }
}

function envHas(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

/**
 * NextAuth refuses to run in production without a secret, and the failure
 * surfaces as a generic 500 on every route that reads a session — with nothing
 * in the response naming the missing variable. Fail with a message that names
 * it, so the deployment log says what to set.
 */
function assertProductionSecret(): void {
  if (process.env.NODE_ENV !== "production") return;
  // `next build` statically imports every route module — including
  // /api/auth/[...nextauth]/route.ts, which must create its handler with
  // `NextAuth(nextAuthOptions())` at module scope; there is no way to defer
  // that call to request time with the App Router adapter. That import runs
  // during the build's "Collecting page data" step, under NODE_ENV=production
  // but not necessarily with the real deployment's secrets visible yet — so
  // this check would fail the BUILD itself, on a host where the secret is
  // simply provisioned for runtime rather than for that build step. Next
  // sets NEXT_PHASE to distinguish exactly this; skip the assertion then and
  // let it fire for real once actual requests are being served.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  if (envHas("NEXTAUTH_SECRET")) return;
  throw new Error(
    "NEXTAUTH_SECRET is not set. Sign-in cannot work in production without it, " +
      "and every page that reads a session will fail with a 500. Generate one " +
      "with `openssl rand -base64 32` and set it in your host's environment variables."
  );
}

export function nextAuthOptions(): NextAuthOptions {
  assertProductionSecret();
  const secureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const demoMode = process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true";

  const providers: NextAuthOptions["providers"] = [];

  // Email + password against the Staff tab. This is the only sign-in the
  // showroom uses — Google OAuth sign-in was registered here for a while but
  // never had a UI path to reach it (no button anywhere called signIn("google")),
  // so it was removed along with GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.
  providers.push(
    CredentialsProvider({
      id: "password",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const { signInWithPassword, describeSignInFailure } = await import("./auth/staff");
        const result = await signInWithPassword(credentials?.email ?? "", credentials?.password ?? "");
        if (!result.ok) {
          // NextAuth surfaces this message to the sign-in page.
          throw new Error(describeSignInFailure(result));
        }
        return {
          id: result.staffId,
          email: result.email,
          name: result.name,
          role: result.role
        };
      }
    })
  );

  // Demo only: pick a staff profile with no password, for the fictional dataset.
  if (demoMode) {
    providers.push(
      CredentialsProvider({
        id: "demo",
        name: "Demo staff login",
        credentials: {
          email: { label: "Staff email", type: "text" },
          role: { label: "Role", type: "text" }
        },
        async authorize(credentials) {
          const email = (credentials?.email ?? "").toLowerCase().trim();
          const role = (credentials?.role ?? "owner") as Role;
          if (!email || !isRole(role)) return null;
          return { id: email, name: email.split("@")[0] ?? "Demo staff", email, role };
        }
      })
    );
  }

  return {
    providers,
    session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
    pages: { signIn: "/login" },
    callbacks: {
      async signIn({ user }) {
        if (demoMode) return true;
        const email = user.email?.toLowerCase();
        if (!email) return false;
        // Allowlist: only staff present in the Staff tab (active) may sign in.
        const { getStore } = await import("@/lib/store");
        const store = getStore();
        const staff = await store.list("Staff", { activeOnly: false });
        const match = staff.find((s) => (s.email ?? "").toLowerCase() === email);
        if (!match || match.active === "FALSE") return false;
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          const email = user.email?.toLowerCase() ?? "";
          if (demoMode) {
            token.role = ((user as { role?: Role }).role ?? "owner") as Role;
            token.staffId = email;
          } else {
            const { getStore } = await import("@/lib/store");
            const staff = await getStore().list("Staff", { activeOnly: false });
            const match = staff.find((s) => (s.email ?? "").toLowerCase() === email);
            token.role = (isRole(match?.role ?? "") ? match!.role : "sales") as Role;
            token.staffId = match?.id;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.role = token.role as Role;
          session.user.id = token.staffId ?? session.user.email ?? "";
        }
        return session;
      }
    },
    cookies: {
      sessionToken: {
        // The `__Secure-` prefix is only valid on HTTPS, and a Secure cookie is
        // discarded outright by the browser over http. Keying this off
        // DEMO_MODE meant every non-demo deployment served over http — local
        // Sheets development, an HTTP staging box — handed the browser a
        // cookie it refused to store, so a correct password appeared to
        // "work" (200 from the callback) and then bounced back to /login.
        // Follow the connection, which is what NextAuth itself does.
        name: demoMode
          ? "showroom.demo.session-token"
          : secureCookies
            ? "__Secure-next-auth.session-token"
            : "next-auth.session-token",
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies }
      }
    }
  };
}

export { ROLE_PERMISSIONS };

/**
 * Server helper for RSC pages.
 *
 * Every caller here is a page component (never an API route — those use
 * withPermission instead), so a missing or since-deactivated session sends
 * the visitor cleanly back to /login rather than throwing into the generic
 * "Something went wrong" error boundary, which is technically correct but a
 * jarring way to land on what is really just a sign-out.
 */
export async function requireSession() {
  const session = await getServerSession(nextAuthOptions());
  if (!session?.user?.email) {
    redirect("/login");
  }
  // Re-checked on every call, not just at sign-in — see assertAccountActive.
  // A session issued before an owner deactivated this account must not keep
  // rendering pages for the rest of its 12-hour life.
  const { assertAccountActive } = await import("./auth/staff");
  const active = await assertAccountActive(session.user.email).then(
    () => true,
    () => false
  );
  if (!active) redirect("/login");
  return session as { user: { id: string; email: string; name?: string | null; role: Role } };
}
