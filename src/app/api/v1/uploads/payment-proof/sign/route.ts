// POST /api/v1/uploads/payment-proof/sign — hands a signed-in customer a
// short-lived Cloudinary signature so their browser can upload ONE payment
// screenshot directly to Cloudinary (Phase D.2). HTTP glue only (ADR-003):
// auth, then delegate to the cloudinary helper. No request body needed.
import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth-guards";
import { PAYMENT_PROOFS_FOLDER, generateUploadSignature } from "@/lib/cloudinary";
import { RATE_LIMITS, enforceRateLimits } from "@/lib/rate-limit";

export async function POST() {
  const guard = await requireCustomer();
  if (guard.response) return guard.response;

  // Rate limit by customer id — a signature mints direct Cloudinary upload
  // access, so cap how many a single account can request per hour.
  const limited = await enforceRateLimits([
    {
      key: `cloudinary-sign:user:${guard.session.user.id}`,
      ...RATE_LIMITS.cloudinarySign,
    },
  ]);
  if (limited) return limited;

  return NextResponse.json(generateUploadSignature(PAYMENT_PROOFS_FOLDER));
}
