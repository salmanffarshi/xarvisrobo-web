// /api/v1/me — the signed-in customer's own profile.
//
// Thin HTTP glue (ADR-003): guard the session, parse + validate, delegate to
// account-service, translate typed errors into the standard envelope.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { updateProfileSchema } from "@/lib/validations/account";
import { getProfile, updateProfile } from "@/services/account-service";
import { PhoneTakenError } from "@/services/auth-service";

/** GET /api/v1/me — current customer profile. */
export async function GET() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const profile = await getProfile(guard.session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[GET /api/v1/me] unexpected error:", error);
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

/** PATCH /api/v1/me — update name + phone. */
export async function PATCH(req: Request) {
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

    const parsed = updateProfileSchema.safeParse(body);
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

    const profile = await updateProfile(guard.session.user.id, parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
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

    console.error("[PATCH /api/v1/me] unexpected error:", error);
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
