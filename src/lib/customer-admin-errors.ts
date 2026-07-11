// Maps customer-admin service errors to the standard HTTP envelope. Anything
// unrecognized is rethrown for the 500 path.

import { NextResponse } from "next/server";

import {
  CustomerNotFoundError,
  NotACustomerError,
  NoteForbiddenError,
  NoteNotFoundError,
} from "@/services/customer-admin-service";

export function customerErrorResponse(error: unknown): NextResponse {
  if (error instanceof CustomerNotFoundError || error instanceof NoteNotFoundError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof NotACustomerError || error instanceof NoteForbiddenError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 403 },
    );
  }
  throw error;
}
