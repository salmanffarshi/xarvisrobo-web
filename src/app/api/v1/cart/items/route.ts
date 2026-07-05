// /api/v1/cart/items — add a product to the signed-in customer's cart.
//
// The body is { productId, quantity } only — never a price (ADR-005). Adding
// a product already in the cart sums quantities, clamped to 5 per item.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { addToCartSchema } from "@/lib/validations/cart";
import { ProductUnavailableError, addItem } from "@/services/cart-service";

/** POST /api/v1/cart/items */
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

    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid cart item.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const cart = await addItem(guard.session.user.id, parsed.data);
    return NextResponse.json({ cart });
  } catch (error) {
    if (error instanceof ProductUnavailableError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 }
      );
    }

    console.error("[POST /api/v1/cart/items] unexpected error:", error);
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
