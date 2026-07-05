// POST /api/v1/me/password — change the signed-in customer's password.
//
// Thin HTTP glue (ADR-003). The service verifies the current password against
// the bcrypt hash; a mismatch surfaces as INVALID_CURRENT_PASSWORD → 400 with
// a safe message (never hints at what the stored password looks like).

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { changePasswordSchema } from "@/lib/validations/account";
import {
  changePassword,
  InvalidCurrentPasswordError,
} from "@/services/account-service";

export async function POST(req: Request) {
  const guard = await requireCustomer();
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
        { status: 400 }
      );
    }

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the form and try again.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const result = await changePassword(guard.session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidCurrentPasswordError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CURRENT_PASSWORD",
            message: "Current password is incorrect",
          },
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/v1/me/password] unexpected error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
