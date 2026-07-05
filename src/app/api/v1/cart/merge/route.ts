// /api/v1/cart/merge — fold the guest (localStorage) cart into the user's DB
// cart right after login/register. Guest lines carry only productId+quantity;
// the service resolves live prices and skips unavailable products.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { mergeCartSchema } from "@/lib/validations/cart";
import { mergeGuestCart } from "@/services/cart-service";

/** POST /api/v1/cart/merge */
export async function POST(req: Request) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = mergeCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid merge payload.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const cart = await mergeGuestCart(guard.session.user.id, parsed.data.items);
    return NextResponse.json({ cart });
  } catch (error) {
    console.error("[POST /api/v1/cart/merge] unexpected error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
