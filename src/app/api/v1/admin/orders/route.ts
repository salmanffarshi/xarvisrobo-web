// /api/v1/admin/orders — staff order list (Phase E.2.1). The admin list page
// calls the service directly (server component); this route exists so future
// admin tooling / the ops app consume the same list (versioned-API principle).
// Read-only, staff-only. Thin glue: guard → parse query → call service.

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireStaff } from "@/lib/auth-guards";
import { adminListOrders } from "@/services/order-service";

const listQuerySchema = z.object({
  status: z
    .enum([
      "WAITING_FOR_PAYMENT",
      "WAITING_FOR_PAYMENT_VERIFICATION",
      "PAYMENT_VERIFIED",
      "WAITING_FOR_ORDER_CONFIRMATION",
      "ORDER_CONFIRMED",
      "IN_PRODUCTION",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ])
    .optional(),
  paymentMethod: z.enum(["BKASH", "NAGAD", "COD"]).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/** GET /api/v1/admin/orders?status=&paymentMethod=&search=&page=&limit= */
export async function GET(request: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  // `|| undefined` folds absent (null) and empty ("") params to undefined so
  // the optional schema sees them as "not provided" rather than invalid.
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") || undefined,
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    search: searchParams.get("search") || undefined,
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "Invalid filter parameters.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await adminListOrders(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/v1/admin/orders] unexpected error:", error);
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
