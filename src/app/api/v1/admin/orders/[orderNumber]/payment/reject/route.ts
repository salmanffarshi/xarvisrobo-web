// POST /api/v1/admin/orders/:orderNumber/payment/reject — admin rejects a
// prepaid payment with a reason (Phase E.2.2). Body: { reason }. The service
// enforces a non-empty reason (→ 400) and the from-state (→ 409).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { rejectPayment } from "@/services/order-actions-service";

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
    const result = await rejectPayment(guard.session.user.id, orderNumber, reason);
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/payment/reject`,
    );
  }
}
