import { NextRequest, NextResponse } from "next/server";
import { guard, NO_STORE, serverError } from "@/lib/api-guard";
import { cancelOrder } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  try {
    const { id } = await context.params;
    const result = await cancelOrder(access.user.id, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Order cancellation", error);
  }
}
