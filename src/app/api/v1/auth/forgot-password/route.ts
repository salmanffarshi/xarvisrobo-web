// POST /api/v1/auth/forgot-password — request a password-reset link.
//
// Thin HTTP glue (ADR-003). ALWAYS returns 200 with the same generic message,
// whether or not the email is registered — enumeration protection lives in the
// service (which no-ops silently for unknown/non-customer/inactive emails).
// Public route (no session).

import { NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestReset } from "@/services/password-reset-service";

// One message for every outcome — never varies by whether the email exists.
const GENERIC_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    // A malformed email is a client error, but we still avoid leaking anything
    // account-specific.
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please enter a valid email address.",
        },
      },
      { status: 400 }
    );
  }

  try {
    await requestReset(parsed.data.email);
  } catch (error) {
    // Never let an internal failure change the response shape (that would be an
    // enumeration/timing tell). Log and still return the generic 200.
    console.error("[POST /api/v1/auth/forgot-password] error:", error);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
}
