// /api/v1/orders — place an order from the signed-in customer's cart.
//
// The Idempotency-Key header is REQUIRED (docs/api-endpoints.md): the client
// generates one UUID per checkout attempt and reuses it on retries, so a
// double-click or a retried request returns the SAME order instead of
// creating two. The body carries no prices — totals are recomputed
// server-side from live DB prices (ADR-005).

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { placeOrderSchema } from "@/lib/validations/order";
import {
  AddressNotFoundError,
  CouponInvalidError,
  EmptyCartError,
  ProductUnavailableError,
  placeOrder,
} from "@/services/order-service";

/** POST /api/v1/orders */
export async function POST(req: Request) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          error: {
            code: "IDEMPOTENCY_KEY_REQUIRED",
            message: "The Idempotency-Key header is required.",
          },
        },
        { status: 400 }
      );
    }

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

    const parsed = placeOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid order details.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { orderNumber } = await placeOrder(
      guard.session.user.id,
      parsed.data,
      idempotencyKey
    );
    return NextResponse.json({ orderNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof EmptyCartError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof ProductUnavailableError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: { productName: error.productName },
          },
        },
        { status: 409 }
      );
    }
    if (error instanceof AddressNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof CouponInvalidError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: { reason: error.reason },
          },
        },
        { status: 409 }
      );
    }

    console.error("[POST /api/v1/orders] unexpected error:", error);
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
