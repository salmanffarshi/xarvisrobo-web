// PATCH /api/v1/admin/customers/:id/active — activate/deactivate a customer.
// Staff-only. Never touches a staff/admin account (service guards → 403).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { customerErrorResponse } from "@/lib/customer-admin-errors";
import { setActiveSchema } from "@/lib/validations/customer-admin";
import { setActive } from "@/services/customer-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = setActiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    await setActive(guard.session.user.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return customerErrorResponse(error);
  }
}
