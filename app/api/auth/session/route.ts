import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.full_name, role: user.role } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to verify session." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
