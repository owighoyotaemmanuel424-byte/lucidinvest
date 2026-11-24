import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { setStaffAccess } from "@/lib/admin-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  if (access.user.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const userId = typeof body.userId === "string" ? body.userId : "";
    const result = await setStaffAccess(access.user.id, userId, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true, role: result.value.role }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Staff access update", error);
  }
}
