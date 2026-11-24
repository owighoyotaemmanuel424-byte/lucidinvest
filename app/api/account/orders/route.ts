import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { placeOrder } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const result = await placeOrder(access.user.id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ order: result.value }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return serverError("Order placement", error);
  }
}
