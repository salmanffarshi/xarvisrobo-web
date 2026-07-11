// /api/v1/admin/categories/:id — update / delete one category. Staff-only.
// DELETE is blocked while any product references the category (CATEGORY_IN_USE).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { updateCategorySchema } from "@/lib/validations/category";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  remove,
  update,
} from "@/services/category-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
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
    if (error instanceof CategoryNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  try {
    await remove(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof CategoryInUseError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: { productCount: error.productCount },
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
