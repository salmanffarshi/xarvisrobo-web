// /api/v1/admin/products/:id/images/:imageId — set primary / reorder (PATCH) or
// remove (DELETE) one image. Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { productErrorResponse } from "@/lib/product-admin-errors";
import { updateImageSchema } from "@/lib/validations/product";
import { removeImage, updateImage } from "@/services/product-admin-service";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id, imageId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid image update.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    await updateImage(id, imageId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id, imageId } = await params;
  try {
    await removeImage(id, imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productErrorResponse(error);
  }
}
