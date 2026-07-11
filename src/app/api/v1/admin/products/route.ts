// /api/v1/admin/products — list all products (incl. inactive) / create one.
// Staff-only. Thin HTTP glue (ADR-003).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { productErrorResponse } from "@/lib/product-admin-errors";
import { createProductSchema } from "@/lib/validations/product";
import { create, list } from "@/services/product-admin-service";

export async function GET(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;

  const result = await list({ search, categoryId, page });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
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
    const product = await create(parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return productErrorResponse(error);
  }
}
