// /api/v1/admin/categories — list all categories / create one. Staff-only.
// Thin HTTP glue (ADR-003): guard, validate at the boundary, delegate.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { createCategorySchema } from "@/lib/validations/category";
import { create, list } from "@/services/category-admin-service";

export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const categories = await list();
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
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

  const category = await create(parsed.data);
  return NextResponse.json({ category }, { status: 201 });
}
