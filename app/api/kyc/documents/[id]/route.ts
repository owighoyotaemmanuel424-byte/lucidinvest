import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getKycDocumentForDownload } from "@/lib/customer-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
    const { id } = await context.params;
    const file = await getKycDocumentForDownload({ id: user.id, role: user.role }, id);
    if (!file) return NextResponse.json({ error: "That document was not found." }, { status: 404 });

    const safeName = file.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "document";
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to download that document." }, { status: 500 });
  }
}
