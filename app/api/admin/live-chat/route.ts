import { NextRequest, NextResponse } from "next/server";
import { guard, jsonObject, NO_STORE, serverError, badRequest } from "@/lib/api-guard";
import { saveLiveChatSettings } from "@/lib/admin-platform";

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
    const enabled = body.enabled;
    const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
    const widgetId = typeof body.widgetId === "string" ? body.widgetId.trim() : "";
    const welcomeMessage = typeof body.welcomeMessage === "string" ? body.welcomeMessage.trim() : "";

    if (typeof enabled !== "boolean") return badRequest("Choose whether live chat should be enabled.");
    if (enabled && (!/^[a-f0-9]{16,64}$/i.test(propertyId) || !/^[a-z0-9]{6,64}$/i.test(widgetId))) {
      return badRequest("Enter a valid Tawk.to Property ID and Widget ID.");
    }
    if (welcomeMessage.length > 120) return badRequest("Welcome message must be 120 characters or fewer.");

    const result = await saveLiveChatSettings(access.user.id, {
      enabled, provider: "tawk", propertyId, widgetId, welcomeMessage,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Live chat configuration", error);
  }
}
