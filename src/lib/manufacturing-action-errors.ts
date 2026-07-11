// Typed-error → HTTP mapping for the manufacturing board routes (Phase E.3).
// Mirrors order-action-errors.ts: the service stays HTTP-agnostic (ADR-003),
// this glue maps its typed errors to statuses so the routes' catch blocks are
// one line. NO_MANUFACTURING → 404, NOT_ACTIVE → 409, INVALID_STAGE → 400.

import { NextResponse } from "next/server";

import {
  InvalidStageError,
  NoManufacturingError,
  NotActiveError,
} from "@/services/manufacturing-service";

export function manufacturingErrorResponse(
  error: unknown,
  tag: string,
): NextResponse {
  if (error instanceof NoManufacturingError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof InvalidStageError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof NotActiveError) {
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
