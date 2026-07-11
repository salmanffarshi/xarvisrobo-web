// POST /api/v1/uploads/product-image/sign — hands a signed-in staff member a
// short-lived Cloudinary signature so their browser can upload ONE product image
// directly to Cloudinary (Phase E.4 Part B). HTTP glue only (ADR-003): staff
// guard, then delegate. The folder is fixed server-side (products); the client
// never chooses it. No request body needed.
import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { PRODUCT_IMAGES_FOLDER, generateUploadSignature } from "@/lib/cloudinary";

export async function POST() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  return NextResponse.json(generateUploadSignature(PRODUCT_IMAGES_FOLDER));
}
