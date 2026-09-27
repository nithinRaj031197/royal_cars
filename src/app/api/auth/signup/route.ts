import { NextRequest, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api";
import { signupInputSchema } from "@/lib/form-schemas";
import { requestSignup } from "@/server/services/signup";

/**
 * Public — no session required. Anyone can request an account; nobody can
 * sign in on the strength of this request alone, because it creates the
 * Staff row with active: "FALSE". An owner must approve it from Settings.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await readJson<unknown>(req);
    const parsed = signupInputSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first?.message ?? "Invalid input" }, { status: 400 });
    }
    const result = await requestSignup(parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
