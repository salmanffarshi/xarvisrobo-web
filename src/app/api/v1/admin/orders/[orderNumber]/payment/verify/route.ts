// POST /api/v1/admin/orders/:orderNumber/payment/verify — admin verifies a
// prepaid payment (Phase E.2.2). HTTP glue only (ADR-003): staff auth, delegate
// to the service (which creates the Manufacturing gate), map errors.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { verifyPayment } from "@/services/order-actions-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  try {
    const result = await verifyPayment(guard.session.user.id, orderNumber);
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/payment/verify`,
    );
  }
}
