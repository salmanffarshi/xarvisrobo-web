// POST /api/v1/admin/manufacturing/:orderNumber/stage — move a job to any stage
// (forward or backward), Phase E.3. Body: { toStage }. Staff-only. The service
// validates the target is a real stage (→ 400), that a Manufacturing row exists
// (→ 404), and that the order is still in active production (→ 409). Moving a
// stage never touches the customer-facing order status (ADR-016).

import { NextResponse } from "next/server";
import type { ManufacturingStatus } from "@prisma/client";

import { requireStaff } from "@/lib/auth-guards";
import { manufacturingErrorResponse } from "@/lib/manufacturing-action-errors";
import { moveStage } from "@/services/manufacturing-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  try {
    const body = await req.json().catch(() => null);
    const toStage = body?.toStage as ManufacturingStatus;
    await moveStage(guard.session.user.id, orderNumber, toStage);
    return NextResponse.json({ orderNumber, internalStatus: toStage });
  } catch (error) {
    return manufacturingErrorResponse(
      error,
      `POST /api/v1/admin/manufacturing/${orderNumber}/stage`,
    );
  }
}
