// POST /api/v1/me/addresses/[id]/default — make this address the default.
//
// Thin HTTP glue (ADR-003). The service demotes all other defaults in the same
// transaction, and the ownership check maps "not yours" to the same 404 as
// "doesn't exist".

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { AddressNotFoundError, setDefault } from "@/services/address-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const address = await setDefault(guard.session.user.id, id);
    return NextResponse.json({ address });
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Address not found" } },
        { status: 404 }
      );
    }

    console.error(
      "[POST /api/v1/me/addresses/:id/default] unexpected error:",
      error
    );
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
