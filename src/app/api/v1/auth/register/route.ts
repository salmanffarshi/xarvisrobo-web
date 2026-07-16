// POST /api/v1/auth/register — create a CUSTOMER account.
//
// Thin HTTP glue (ADR-003): parse + validate the request, delegate to the
// service, translate the result (or typed errors) into the standard response
// envelope `{ error: { code, message, details? } }`.

import { NextResponse } from "next/server";

import { registerSchema } from "@/lib/validations/auth";
import {
  RATE_LIMITS,
  enforceRateLimits,
  getClientIp,
} from "@/lib/rate-limit";
import {
  EmailTakenError,
  PhoneTakenError,
  registerCustomer,
} from "@/services/auth-service";

export async function POST(req: Request) {
  try {
    // Rate limit by IP — caps account-creation abuse from a single source.
    const limited = await enforceRateLimits([
      { key: `register:ip:${getClientIp(req)}`, ...RATE_LIMITS.register },
    ]);
    if (limited) return limited;

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

    const parsed = registerSchema.safeParse(body);
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

    const user = await registerCustomer(parsed.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "Email already registered" } },
        { status: 409 }
      );
    }
    if (error instanceof PhoneTakenError) {
      return NextResponse.json(
        {
          error: {
            code: "PHONE_TAKEN",
            message: "That phone number is already in use.",
          },
        },
        { status: 409 }
      );
    }

    // Unexpected — log server-side (never leak internals to the client).
    console.error("[POST /api/v1/auth/register] unexpected error:", error);
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
