// GET /api/v1/products — public paginated product list with filters.
//
// Thin HTTP glue (ADR-003): validate query params with zod, delegate to
// product-service, return its result as-is. No auth — public catalog.

import { NextResponse } from "next/server";
import { z } from "zod";

import * as productService from "@/services/product-service";

// This route reads `request.url` (query-string filters), so it is inherently
// request-dependent and can never be statically rendered. Declare that up front
// so Next doesn't attempt static optimization and log a benign
// DYNAMIC_SERVER_USAGE warning at build time. Behavior is unchanged — the route
// was already served dynamically.
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined
    ),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(url.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_QUERY",
            message: "Invalid query parameters.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { category, ...rest } = parsed.data;
    const result = await productService.list({
      ...rest,
      categorySlug: category,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/v1/products] unexpected error:", error);
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
