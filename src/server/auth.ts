import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
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

export const authOptions: NextAuthOptions = nextAuthOptions();

function envHas(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

export function nextAuthOptions(): NextAuthOptions {
  const demoMode = process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true";

  const providers: NextAuthOptions["providers"] = [];

  // Email + password against the Staff tab. This is the sign-in the showroom
  // uses; Google sign-in remains available when an OAuth client is configured.
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

  // Optional: Google sign-in, when an OAuth client is configured.
  if (envHas("GOOGLE_CLIENT_ID") && envHas("GOOGLE_CLIENT_SECRET")) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        authorization: { params: { prompt: "consent", access_type: "offline", scope: "openid email profile" } }
      })
    );
  }

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
        name: demoMode
          ? "showroom.demo.session-token"
          : "__Secure-next-auth.session-token",
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: !demoMode }
      }
    }
  };
}

export { ROLE_PERMISSIONS };

/** Server helper for RSC pages. */
export async function requireSession() {
  const session = await getServerSession(nextAuthOptions());
  if (!session?.user?.email) {
    throw Object.assign(new Error("Not signed in"), { status: 401 });
  }
  return session as { user: { id: string; email: string; name?: string | null; role: Role } };
}
