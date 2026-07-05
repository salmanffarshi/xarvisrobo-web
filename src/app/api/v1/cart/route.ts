// /api/v1/cart — the signed-in customer's cart (Phase C.1).
//
// Thin HTTP glue (ADR-003): guard, call cart-service, return the CartView.
// All prices in the response are live DB prices (ADR-015).

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { clearCart, getCart } from "@/services/cart-service";

const internalError = (route: string, error: unknown) => {
  console.error(`[${route}] unexpected error:`, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 }
  );
};

/** GET /api/v1/cart — current cart with live prices. */
export async function GET() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const cart = await getCart(guard.session.user.id);
    return NextResponse.json({ cart });
  } catch (error) {
    return internalError("GET /api/v1/cart", error);
  }
}

/** DELETE /api/v1/cart — remove every item. */
export async function DELETE() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const cart = await clearCart(guard.session.user.id);
    return NextResponse.json({ cart });
  } catch (error) {
    return internalError("DELETE /api/v1/cart", error);
  }
}
