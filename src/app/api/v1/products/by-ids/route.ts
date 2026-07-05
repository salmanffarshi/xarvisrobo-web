// /api/v1/products/by-ids?ids=a,b,c — public batch product lookup (Phase C.1).
//
// Exists so the GUEST cart can hydrate names/prices for its stored productIds
// (guests have no cart API access). Inactive or nonexistent ids are simply
// omitted — the guest cart UI treats missing ids as "no longer available".

import { NextResponse } from "next/server";
import { z } from "zod";

import { listByIds } from "@/services/product-service";

const idsSchema = z.array(z.string().cuid()).max(50);

/** GET /api/v1/products/by-ids?ids=comma,separated,cuids (max 50) */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get("ids") ?? "";
    const ids = raw.split(",").filter(Boolean);

    const parsed = idsSchema.safeParse(ids);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "ids must be up to 50 comma-separated product ids.",
          },
        },
        { status: 400 }
      );
    }

    const data = await listByIds(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/v1/products/by-ids] unexpected error:", error);
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
