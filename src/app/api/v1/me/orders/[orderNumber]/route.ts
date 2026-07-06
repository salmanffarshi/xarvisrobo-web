// /api/v1/me/orders/[orderNumber] — one order, customer view.
//
// Ownership enforced in the service: an order that exists but belongs to
// someone else is indistinguishable from one that doesn't (404 either way).
// Excludes Manufacturing internals (ADR-006). The confirmation page calls the
// service directly (server component); this route exists for the mobile app.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { getOrderForCustomer } from "@/services/order-service";

/** GET /api/v1/me/orders/:orderNumber */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { orderNumber } = await params;
    const order = await getOrderForCustomer(guard.session.user.id, orderNumber);
    if (!order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Order not found." } },
        { status: 404 }
      );
    }
    return NextResponse.json({ order });
  } catch (error) {
    console.error(
      "[GET /api/v1/me/orders/[orderNumber]] unexpected error:",
      error
    );
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
