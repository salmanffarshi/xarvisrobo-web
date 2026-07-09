// POST /api/v1/me/orders/:orderNumber/payment-proof — a customer submits proof
// of a prepaid payment (Phase D.2). HTTP glue only (ADR-003): auth, parse,
// delegate to paymentService, map typed errors to status codes.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { submitProofSchema } from "@/lib/validations/payment";
import {
  InvalidScreenshotError,
  InvalidStateError,
  OrderNotFoundError,
  submitPaymentProof,
} from "@/services/payment-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { orderNumber } = await params;

    const body = await req.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        {
          error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
        },
        { status: 400 },
      );
    }

    const parsed = submitProofSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payment details.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    await submitPaymentProof(guard.session.user.id, orderNumber, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof InvalidStateError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    if (error instanceof InvalidScreenshotError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }

    console.error(
      "[POST /api/v1/me/orders/:orderNumber/payment-proof] unexpected error:",
      error,
    );
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
