import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { markNotificationsRead } from "@/lib/customer-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  try {
    const body = (await jsonObject(request)) ?? {};
    const id = typeof body.id === "string" ? body.id : undefined;
    await markNotificationsRead(access.user.id, id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Notification update", error);
  }
}
