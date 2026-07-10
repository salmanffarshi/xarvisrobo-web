// Shared typed-error → HTTP mapping for the admin order-action routes (Phase
// E.2.2). All five action routes throw the same order-actions-service errors and
// map them identically; centralising the map here keeps their catch blocks to
// one line and guarantees they never diverge. Services stay HTTP-agnostic
// (ADR-003) — this glue lives in the API layer.

import { NextResponse } from "next/server";

import {
  InvalidStateError,
  InvalidTransitionError,
  OrderNotFoundError,
  ReasonRequiredError,
} from "@/services/order-actions-service";

/**
 * Map a caught error from an order-action service call to a NextResponse.
 * Known typed errors get their proper status; anything else is logged with
 * `tag` and returned as a 500.
 */
export function orderActionErrorResponse(
  error: unknown,
  tag: string,
): NextResponse {
  if (error instanceof OrderNotFoundError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ReasonRequiredError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 400 },
    );
  }
  if (
    error instanceof InvalidStateError ||
    error instanceof InvalidTransitionError
  ) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 409 },
    );
  }

  console.error(`[${tag}] unexpected error:`, error);
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
