// POST /api/v1/coupons/validate — display-only coupon check for checkout.
// Customer-only. Body carries ONLY the code; the subtotal is computed from the
// caller's own cart server-side (ADR-005). Authoritative validation happens
// again at placement — this endpoint never redeems anything.

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCustomer } from "@/lib/auth-guards";
import { previewCoupon } from "@/services/coupon-service";

const bodySchema = z.object({ code: z.string().trim().min(1).max(40) });

export async function POST(req: Request) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Enter a coupon code." } },
      { status: 400 },
    );
  }

  const preview = await previewCoupon(guard.session.user.id, parsed.data.code);
  return NextResponse.json(preview);
}
