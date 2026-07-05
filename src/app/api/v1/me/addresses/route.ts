// /api/v1/me/addresses — the signed-in customer's saved addresses.
//
// Thin HTTP glue (ADR-003). Ownership scoping happens in address-service:
// every query is filtered by the session's userId.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { createAddressSchema } from "@/lib/validations/address";
import { create, list } from "@/services/address-service";

/** GET /api/v1/me/addresses — all addresses, default first. */
export async function GET() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const addresses = await list(guard.session.user.id);
    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("[GET /api/v1/me/addresses] unexpected error:", error);
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

/** POST /api/v1/me/addresses — add an address (first one becomes default). */
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

    const parsed = createAddressSchema.safeParse(body);
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

    const address = await create(guard.session.user.id, parsed.data);
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/me/addresses] unexpected error:", error);
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
