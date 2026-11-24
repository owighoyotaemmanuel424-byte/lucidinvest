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
    const provider = typeof body.provider === "string" ? body.provider : "";
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
    const siteUrl = typeof body.siteUrl === "string" ? body.siteUrl.trim() : "";

    if (typeof enabled !== "boolean") return badRequest("Choose whether live chat should be enabled.");
    if (!["tawk","crisp","intercom","chatwoot"].includes(provider)) return badRequest("Choose a supported chat provider.");
    if (enabled) {
      const valid = provider==="tawk" ? (()=>{const [p,w]=siteId.split("/");return /^[a-f0-9]{16,64}$/i.test(p||"")&&/^[a-z0-9]{6,64}$/i.test(w||"");})()
       : provider==="crisp" ? /^[a-f0-9-]{20,40}$/i.test(siteId)
       : provider==="intercom" ? /^[a-z0-9]{6,16}$/i.test(siteId)
       : /^[a-z0-9_-]{8,128}$/i.test(siteId)&&(()=>{try{return new URL(siteUrl).protocol==="https:";}catch{return false;}})();
      if(!valid)return badRequest("Enter a valid identifier and any required provider URL.");
    }
    const result=await saveLiveChatSettings(access.user.id,{enabled,provider:provider as "tawk"|"crisp"|"intercom"|"chatwoot",siteId,siteUrl});
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Live chat configuration", error);
  }
}
