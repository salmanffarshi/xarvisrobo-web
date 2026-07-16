// POST /api/v1/contact — public contact form submission.
//
// Thin HTTP glue (ADR-003): parse + validate the request, delegate to
// contact-service, translate errors into the standard response envelope
// `{ error: { code, message, details? } }`. No auth — this is public.

import { NextResponse } from "next/server";

import {
  RATE_LIMITS,
  enforceRateLimits,
  getClientIp,
} from "@/lib/rate-limit";
import { contactMessageSchema } from "@/lib/validations/contact";
import { SpamRejectedError, submitMessage } from "@/services/contact-service";

export async function POST(req: Request) {
  try {
    // Rate limit by IP — caps contact-form spam floods.
    const limited = await enforceRateLimits([
      { key: `contact:ip:${getClientIp(req)}`, ...RATE_LIMITS.contact },
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

    const parsed = contactMessageSchema.safeParse(body);
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

    const result = await submitMessage(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SpamRejectedError) {
      return NextResponse.json(
        {
          error: {
            code: "SPAM_REJECTED",
            message: "Your message could not be sent.",
          },
        },
        { status: 400 }
      );
    }

    // Unexpected — log server-side (never leak internals to the client).
    console.error("[POST /api/v1/contact] unexpected error:", error);
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
