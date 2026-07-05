// GET /api/v1/products/:slug — public product detail (active products only).
//
// Thin HTTP glue (ADR-003): delegate to product-service, 404 on miss.
// No auth — public catalog.

import { NextResponse } from "next/server";

import * as productService from "@/services/product-service";

// Cache hint: product details change rarely; 5 minutes of staleness is fine.
export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await productService.getBySlug(slug);
    if (!product) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Product not found",
          },
        },
        { status: 404 }
      );
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error("[GET /api/v1/products/:slug] unexpected error:", error);
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
