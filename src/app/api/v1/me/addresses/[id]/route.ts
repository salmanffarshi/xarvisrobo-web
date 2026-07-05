// /api/v1/me/addresses/[id] — one saved address, ownership-checked.
//
// Thin HTTP glue (ADR-003). The service only ever sees the session's userId,
// so an address owned by someone else comes back null / AddressNotFoundError —
// both map to 404, indistinguishable from a nonexistent id.

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { addressSchema } from "@/lib/validations/address";
import {
  AddressNotFoundError,
  get,
  remove,
  update,
} from "@/services/address-service";

const notFound = () =>
  NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Address not found" } },
    { status: 404 }
  );

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/v1/me/addresses/:id */
export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const address = await get(guard.session.user.id, id);
    if (!address) return notFound();
    return NextResponse.json({ address });
  } catch (error) {
    console.error("[GET /api/v1/me/addresses/:id] unexpected error:", error);
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

/** PATCH /api/v1/me/addresses/:id — update fields / default flag. */
export async function PATCH(req: Request, { params }: RouteContext) {
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

    const parsed = addressSchema.safeParse(body);
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

    const { id } = await params;
    const address = await update(guard.session.user.id, id, parsed.data);
    return NextResponse.json({ address });
  } catch (error) {
    if (error instanceof AddressNotFoundError) return notFound();

    console.error("[PATCH /api/v1/me/addresses/:id] unexpected error:", error);
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

/** DELETE /api/v1/me/addresses/:id — delete; promotes a new default if needed. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    await remove(guard.session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AddressNotFoundError) return notFound();

    console.error("[DELETE /api/v1/me/addresses/:id] unexpected error:", error);
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
