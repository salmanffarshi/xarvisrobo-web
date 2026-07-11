// POST /api/v1/uploads/payment-proof/sign — hands a signed-in customer a
// short-lived Cloudinary signature so their browser can upload ONE payment
// screenshot directly to Cloudinary (Phase D.2). HTTP glue only (ADR-003):
// auth, then delegate to the cloudinary helper. No request body needed.
import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { PAYMENT_PROOFS_FOLDER, generateUploadSignature } from "@/lib/cloudinary";

export async function POST() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  return NextResponse.json(generateUploadSignature(PAYMENT_PROOFS_FOLDER));
}
