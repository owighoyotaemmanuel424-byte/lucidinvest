import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildReport } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

    const { kind } = await context.params;
    const format = (request.nextUrl.searchParams.get("format") ?? "csv").toLowerCase() === "pdf" ? "pdf" : "csv";
    if (!/^[a-z_]{2,40}$/.test(kind)) {
      return NextResponse.json({ error: "Unknown report." }, { status: 400 });
    }

    const report = await buildReport(
      { id: user.id, role: user.role, full_name: user.full_name, email: user.email },
      kind,
      format,
    );
    if (!report) return NextResponse.json({ error: "That report is not available." }, { status: 404 });

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `lucidinvest-${kind.replace(/_/g, "-")}-${stamp}.${report.extension}`;
    const body = typeof report.body === "string" ? report.body : new Uint8Array(report.body);

    return new NextResponse(body, {
      headers: {
        "Content-Type": report.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Report generation failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Unable to generate that report." }, { status: 500 });
  }
}
