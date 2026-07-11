// PATCH /api/v1/admin/settings — update the store Settings singleton (Phase E.4
// Part A). Staff-only. Thin HTTP glue (ADR-003): guard, validate at the boundary
// (→ 400 with field errors), delegate to settings-service.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { updateSettingsSchema } from "@/lib/validations/settings";
import { updateSettings } from "@/services/settings-service";

export async function PATCH(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  try {
    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 },
      );
    }

    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the form and try again.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const settings = await updateSettings(guard.session.user.id, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[PATCH /api/v1/admin/settings] unexpected error:", error);
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
