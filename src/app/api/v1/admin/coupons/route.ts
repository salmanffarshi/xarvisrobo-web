// /api/v1/admin/coupons — list all coupons / create one. Staff-only.
// Thin HTTP glue (ADR-003): guard, validate at the boundary, delegate.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { createCouponSchema } from "@/lib/validations/coupon";
import { CouponCodeTakenError, create, list } from "@/services/coupon-admin-service";

export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const coupons = await list();
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = createCouponSchema.safeParse(body);
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
    const coupon = await create(parsed.data);
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof CouponCodeTakenError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    throw error;
  }
}
