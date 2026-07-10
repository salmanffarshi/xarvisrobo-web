// /api/v1/admin/orders/:orderNumber — staff order detail (Phase E.2.1). The
// detail page calls the service directly; this route mirrors it for the ops
// app. Read-only, staff-only. 404 when the order doesn't exist.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { adminGetOrder } from "@/services/order-service";

/** GET /api/v1/admin/orders/:orderNumber */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;

  try {
    const order = await adminGetOrder(orderNumber);
    if (!order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Order not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error(
      `[GET /api/v1/admin/orders/${orderNumber}] unexpected error:`,
      error,
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 },
    );
  }
}
