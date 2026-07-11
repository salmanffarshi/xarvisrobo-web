// Customer-facing coupon preview (Phase E.5, ADR-003). DISPLAY-ONLY: given a
// code, it computes the discount against the customer's OWN cart subtotal
// (server-side — never a client-sent subtotal, ADR-005) so checkout can show a
// "−৳X" line. It does NOT redeem anything and takes no lock — the authoritative
// validation + redemption happens again atomically at placement (order-service).

import { db } from "@/lib/db";
import {
  COUPON_REASON_MESSAGES,
  normalizeCode,
  validateCoupon,
  type CouponFailureReason,
} from "@/lib/coupon";
import { getCart } from "@/services/cart-service";

export type CouponPreview =
  | { valid: true; code: string; discount: string; subtotal: string }
  | { valid: false; reason: CouponFailureReason; message: string };

/** Preview whether `rawCode` applies to `userId`'s current cart, and by how
 * much. The subtotal is read from the cart with live prices; the discount is
 * from the shared pure module, so it matches what placement will compute. */
export async function previewCoupon(
  userId: string,
  rawCode: string,
): Promise<CouponPreview> {
  const code = normalizeCode(rawCode);
  const { subtotal } = await getCart(userId);

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) {
    return {
      valid: false,
      reason: "NOT_FOUND",
      message: COUPON_REASON_MESSAGES.NOT_FOUND,
    };
  }

  const [totalRedemptionCount, userRedemptionCount] = await Promise.all([
    db.couponRedemption.count({ where: { couponId: coupon.id } }),
    db.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
  ]);

  const result = validateCoupon({
    coupon,
    subtotal,
    userRedemptionCount,
    totalRedemptionCount,
    now: new Date(),
  });
  if (!result.ok) {
    return { valid: false, reason: result.reason, message: result.message };
  }

  return { valid: true, code, discount: result.discount, subtotal };
}
