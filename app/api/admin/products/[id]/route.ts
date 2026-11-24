import { NextRequest, NextResponse } from "next/server";
import { badRequest, guard, jsonObject, NO_STORE, serverError } from "@/lib/api-guard";
import { staffCan } from "@/lib/admin-platform";
import { updateProduct } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await guard(request, { staff: true });
  if (!access.ok) return access.response;
  if (!(await staffCan(access.user, "products.write"))) {
    return NextResponse.json({ error: "You do not have permission to change products." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await jsonObject(request);
    if (!body) return badRequest("Invalid request.");
    const { id } = await context.params;
    const result = await updateProduct(access.user.id, id, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json({ product: result.value }, { headers: NO_STORE });
  } catch (error) {
    return serverError("Product update", error);
  }
}
