import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { staffCan } from "@/lib/admin-platform";
import { decideOrder } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await guard(request, { staff: true });
  if (!access.ok) return access.response;
  if (!(await staffCan(access.user, "investments.write"))) {
    return NextResponse.json({ error: "You do not have permission to settle orders." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const { id } = await context.params;
    const result = await decideOrder(access.user.id, id, body.status);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, status: result.value.status }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Order settlement", error);
  }
}
