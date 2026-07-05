// /api/v1/cart/items/[itemId] — update or remove one cart line.
//
// Ownership-checked in cart-service: an item id belonging to another user's
// cart returns 404, indistinguishable from a nonexistent id (same discipline
// as /api/v1/me/addresses/:id).

import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { updateCartItemSchema } from "@/lib/validations/cart";
import {
  CartItemNotFoundError,
  removeItem,
  updateItem,
} from "@/services/cart-service";

const notFound = () =>
  NextResponse.json(
    { error: { code: "NOT_FOUND", message: "Cart item not found" } },
    { status: 404 }
  );

type RouteContext = { params: Promise<{ itemId: string }> };

/** PATCH /api/v1/cart/items/:itemId — set quantity (1..5). */
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

    const parsed = updateCartItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid quantity.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { itemId } = await params;
    const cart = await updateItem(guard.session.user.id, itemId, parsed.data);
    return NextResponse.json({ cart });
  } catch (error) {
    if (error instanceof CartItemNotFoundError) return notFound();

    console.error("[PATCH /api/v1/cart/items/:itemId] unexpected error:", error);
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

/** DELETE /api/v1/cart/items/:itemId — remove the line. */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  try {
    const { itemId } = await params;
    const cart = await removeItem(guard.session.user.id, itemId);
    return NextResponse.json({ cart });
  } catch (error) {
    if (error instanceof CartItemNotFoundError) return notFound();

    console.error("[DELETE /api/v1/cart/items/:itemId] unexpected error:", error);
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
