// POST /api/v1/auth/reset-password — redeem a token and set a new password.
//
// Thin HTTP glue (ADR-003). Public route (no session). Two failure shapes:
//   - 400 VALIDATION_ERROR (with field details) for a weak/mismatched password.
//   - 400 INVALID_TOKEN (generic, no details) for a bad/expired/used token —
//     we never reveal which.
// Success is 200; the service does NOT auto-login, so the UI sends the user to
// /login afterward.

import { NextResponse } from "next/server";

import { resetPasswordSchema } from "@/lib/validations/auth";
import {
  InvalidResetTokenError,
  resetPassword,
} from "@/services/password-reset-service";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const parsed = resetPasswordSchema.safeParse(body);
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

    await resetPassword(parsed.data.token, parsed.data.newPassword);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof InvalidResetTokenError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "This reset link is invalid or has expired.",
          },
        },
        { status: 400 }
      );
    }

    console.error("[POST /api/v1/auth/reset-password] unexpected error:", error);
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
