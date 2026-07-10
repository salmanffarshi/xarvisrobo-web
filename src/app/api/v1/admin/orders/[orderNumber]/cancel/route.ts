// POST /api/v1/admin/orders/:orderNumber/cancel — admin cancels an order with a
// reason (Phase E.2.2). Body: { reason }. The service enforces a non-empty
// reason (→ 400) and that the order is in a cancellable state (→ 409).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { cancelOrder } from "@/services/order-actions-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  try {
    const body = await req.json().catch(() => null);
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const result = await cancelOrder(guard.session.user.id, orderNumber, reason);
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/cancel`,
    );
  }
}
