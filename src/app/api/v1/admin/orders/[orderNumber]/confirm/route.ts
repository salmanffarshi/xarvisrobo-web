// POST /api/v1/admin/orders/:orderNumber/confirm — admin confirms a COD order
// after the phone call (Phase E.2.2). Delegates to the service (which creates
// the Manufacturing gate). No body.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { confirmCodOrder } from "@/services/order-actions-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  try {
    const result = await confirmCodOrder(guard.session.user.id, orderNumber);
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/confirm`,
    );
  }
}
