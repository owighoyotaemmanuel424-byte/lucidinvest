import { NextResponse } from "next/server";
import { getLiveChatSettings } from "@/lib/admin-platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getLiveChatSettings();
    return NextResponse.json({
      enabled: settings.enabled,
      provider: settings.provider,
      siteId: settings.siteId,
      siteUrl: settings.siteUrl,
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ enabled: false, provider: "tawk", siteId: "", siteUrl: "" }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
