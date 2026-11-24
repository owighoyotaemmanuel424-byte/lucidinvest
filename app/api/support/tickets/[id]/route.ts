import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { replyToTicket } from "@/lib/customer-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const { id } = await context.params;
    const result = await replyToTicket({ id: access.user.id, role: access.user.role }, id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, status: result.value.status }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Support reply", error);
  }
}
