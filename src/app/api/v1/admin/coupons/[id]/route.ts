// /api/v1/admin/coupons/:id — get / update / hard-delete one coupon. Staff-only.
// Deactivation is a PATCH { isActive: false }. DELETE is a HARD delete, blocked
// once the coupon has any redemption (COUPON_HAS_REDEMPTIONS → deactivate instead).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { updateCouponSchema } from "@/lib/validations/coupon";
import {
  CouponCodeTakenError,
  CouponHasRedemptionsError,
  CouponNotFoundError,
  get,
  remove,
  update,
} from "@/services/coupon-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  try {
    const coupon = await get(id);
    return NextResponse.json({ coupon });
  } catch (error) {
    if (error instanceof CouponNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateCouponSchema.safeParse(body);
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
    if (error instanceof CouponNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof CouponCodeTakenError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
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
    if (error instanceof CouponNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof CouponHasRedemptionsError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: { redemptionCount: error.redemptionCount },
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
