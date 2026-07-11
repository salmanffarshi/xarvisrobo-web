// Maps product-admin service errors to the standard HTTP envelope (ADR: route
// handlers are glue). Anything unrecognized is rethrown for the 500 path.

import { NextResponse } from "next/server";

import {
  ProductHasOrdersError,
  ProductNotFoundError,
  SkuTakenError,
} from "@/services/product-admin-service";

export function productErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProductNotFoundError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof SkuTakenError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ProductHasOrdersError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 409 },
    );
  }
  throw error;
}
