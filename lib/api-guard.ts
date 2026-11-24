import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/same-origin";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
};

export type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

/**
 * Shared entry guard for write routes: a live session, optionally a staff role,
 * and a same-origin request. The same checks are repeated in each handler rather
 * than relying on middleware alone.
 */
export async function guard(
  request: NextRequest,
  options: { staff?: boolean; sameOrigin?: boolean } = {},
): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: NO_STORE }),
    };
  }
  if (options.staff && user.role !== "admin" && user.role !== "compliance") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Staff access is required." }, { status: 403, headers: NO_STORE }),
    };
  }
  if (options.sameOrigin !== false && !isSameOriginRequest(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "This action must be started from the platform." }, { status: 403, headers: NO_STORE }),
    };
  }
  return { ok: true, user };
}

export function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function jsonObject(request: NextRequest): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function serverError(scope: string, error: unknown) {
  console.error(`${scope} failed`, error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: "Unable to complete that action right now." }, { status: 500, headers: NO_STORE });
}
