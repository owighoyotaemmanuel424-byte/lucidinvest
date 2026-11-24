import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { staffCan } from "@/lib/admin-platform";
import { createProduct } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await guard(request, { staff: true });
  if (!access.ok) return access.response;
  if (!(await staffCan(access.user, "products.write"))) {
    return NextResponse.json({ error: "You do not have permission to publish products." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const result = await createProduct(access.user.id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ product: result.value }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return serverError("Product creation", error);
  }
}
