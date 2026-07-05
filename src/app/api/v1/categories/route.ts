// GET /api/v1/categories — public category list with active-product counts.
//
// Thin HTTP glue (ADR-003): no params to parse, delegate to category-service,
// return the standard envelope. No auth — public catalog.

import { NextResponse } from "next/server";

import * as categoryService from "@/services/category-service";

export async function GET() {
  try {
    const categories = await categoryService.list();
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("[GET /api/v1/categories] unexpected error:", error);
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
