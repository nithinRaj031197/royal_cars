import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { can, Permission } from "./permissions";
import { ZodError } from "zod";
import { StoreError } from "./store/types";

export interface HandlerCtx {
  user: { id: string; email: string; name: string; role: import("./permissions").Role };
  req: NextRequest;
  params?: Promise<Record<string, string>>;
}

type Handler = (ctx: HandlerCtx) => Promise<NextResponse | Response>;

/** Wraps an API route with session auth, permission enforcement and safe errors. */
export function withPermission(perm: Permission, handler: Handler) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      const session = await getServerSession(authOptions);
      const user = session?.user as HandlerCtx["user"] | undefined;
      if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      if (!can(user, perm)) return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
      return await handler({ user, req, params: routeCtx?.params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): NextResponse {
  // A Zod failure is the caller sending bad input, not a server fault. Without
  // this it falls through as a 500 "Something went wrong", which hides the
  // actual problem from the user and logs a false server error.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.filter((p) => typeof p === "string").join(".");
    const message = first?.message ?? "Invalid input";
    return NextResponse.json({ error: field ? `${field}: ${message}` : message }, { status: 400 });
  }

  const e = err as { status?: number; message?: string; name?: string };
  const status = typeof e?.status === "number" ? e.status : 500;
  const message =
    e instanceof StoreError || e?.name === "StaleEditError" || e?.name === "NotFoundError" || status < 500
      ? e?.message ?? "Request failed"
      : "Something went wrong. Please try again.";
  if (status >= 500) console.error("[api]", (err as Error)?.message);
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw Object.assign(new Error("Invalid request body"), { status: 400 });
  }
}

/** Minimal structural type any zod schema satisfies; avoids zod generic variance pain. */
interface BodyParser<T> {
  safeParse: (v: unknown) =>
    | { success: true; data: T }
    | { success: false; error?: { issues?: Array<{ message: string }> } };
}

/** Parses body with a zod schema, throwing a 400 with the first issue. */
export async function parseBody<T>(req: NextRequest, schema: BodyParser<T>): Promise<T> {
  const body = await readJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error?.issues?.[0];
    throw Object.assign(new Error(first?.message ?? "Invalid input"), { status: 400 });
  }
  return parsed.data;
}
