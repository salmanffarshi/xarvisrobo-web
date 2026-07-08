// /api/v1/me/orders — the signed-in customer's order history, newest first.
//
// The account page calls the service directly (server component); this route
// exists so the future mobile app consumes the same list. Ownership is
// intrinsic — the service scopes every query to the session user, so a
// customer can only ever list their own orders. No Manufacturing internals
// (ADR-006).

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCustomer } from "@/lib/auth-guards";
import { listForCustomer } from "@/services/order-service";

// Query params are coerced from strings and bounded; anything out of range is
// a 400 rather than a silent clamp, so callers get honest feedback.
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** GET /api/v1/me/orders?page=1&limit=20 */
export async function GET(req: Request) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "Invalid pagination parameters.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await listForCustomer(guard.session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/v1/me/orders] unexpected error:", error);
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
