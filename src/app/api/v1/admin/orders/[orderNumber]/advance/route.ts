// POST /api/v1/admin/orders/:orderNumber/advance — admin advances the
// customer-facing status by one guided step (Phase E.2.2). Body: { toStatus }.
// The service validates the (from, to) pair against ADVANCE_MAP (→ 409 on any
// illegal step); a garbage toStatus is simply an illegal transition and never
// reaches the DB.

import { NextResponse } from "next/server";
import type { OrderStatus } from "@prisma/client";

import { requireStaff } from "@/lib/auth-guards";
import { orderActionErrorResponse } from "@/lib/order-action-errors";
import { advanceStatus } from "@/services/order-actions-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  try {
    const body = await req.json().catch(() => null);
    const toStatus = body?.toStatus as OrderStatus;
    const result = await advanceStatus(
      guard.session.user.id,
      orderNumber,
      toStatus,
    );
    return NextResponse.json(result);
  } catch (error) {
    return orderActionErrorResponse(
      error,
      `POST /api/v1/admin/orders/${orderNumber}/advance`,
    );
  }
}
