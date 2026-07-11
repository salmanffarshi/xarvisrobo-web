// /api/v1/admin/products/:id — detail / update / delete. Staff-only.
// DELETE soft-deletes (deactivates) by default; ?hard=true permanently removes,
// guarded by the no-orders rule (→ 409 PRODUCT_HAS_ORDERS).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { productErrorResponse } from "@/lib/product-admin-errors";
import { updateProductSchema } from "@/lib/validations/product";
import {
  get,
  hardDelete,
  softDelete,
  update,
} from "@/services/product-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const product = await get(id);
  if (!product) {
    return NextResponse.json(
      { error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the form and try again.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    await update(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productErrorResponse(error);
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const hard = new URL(req.url).searchParams.get("hard") === "true";

  try {
    if (hard) {
      await hardDelete(id);
    } else {
      await softDelete(id);
    }
    return NextResponse.json({ ok: true, hard });
  } catch (error) {
    return productErrorResponse(error);
  }
}
