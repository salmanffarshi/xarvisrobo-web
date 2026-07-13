// POST /api/v1/admin/orders/:orderNumber/return — admin marks an order RETURNED
// with a reason (Phase F). Body: { reason }. The service enforces a non-empty
// reason (→ 400) and that the order is in a returnable state — SHIPPED or
// DELIVERED (→ 409). Marking returned reverses recognized revenue via the
// predicate; the order record is kept.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { markReturned } from "@/services/order-actions-service";

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
    const result = await markReturned(guard.session.user.id, orderNumber, reason);
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/return`,
    );
  }
}
