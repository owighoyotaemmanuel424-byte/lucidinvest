import { NextRequest, NextResponse } from "next/server";
import { guard, NO_STORE, serverError } from "@/lib/api-guard";
import { uploadKycDocument } from "@/lib/customer-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await guard(request);
  if (!access.ok) return access.response;
  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Upload a PDF, JPEG or PNG document up to 5 MB." }, { status: 400, headers: NO_STORE });
    }
    const result = await uploadKycDocument(access.user.id, form);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ document: result.value }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return serverError("KYC document upload", error);
  }
}
