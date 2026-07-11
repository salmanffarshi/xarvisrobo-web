// Coupon validation + discount logic (Phase E.5) — PURE, no DB, no I/O.
//
// This module is the SINGLE SOURCE OF TRUTH for (a) whether a coupon may be
// applied to a given cart subtotal right now, and (b) how much it discounts.
// Both the display-only checkout-validate endpoint AND the authoritative
// placement redemption call the same two functions, so the discount a customer
// is shown at checkout is exactly the discount stored on the order.
//
// Money is decimal-only (decimal.js) — never JS floats. The discount is always
// capped at the subtotal, so it can never make a total negative (ADR-017).
// The discount applies to the SUBTOTAL only — delivery is never discounted.

import Decimal from "decimal.js";

import type { DiscountType } from "@prisma/client";

/** Anything that stringifies to a plain decimal — a Prisma.Decimal, a string,
 * or a number. Lets callers pass a Prisma row field directly without mapping. */
type MoneyLike = { toString(): string };

function dec(value: MoneyLike): Decimal {
  return new Decimal(value.toString());
}

/** Trim + uppercase. Codes are stored UPPERCASE and matched case-insensitively,
 * so "save10", " SAVE10 " and "Save10" all resolve to "SAVE10". */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** The coupon fields validation + discount need. Prisma's Coupon row satisfies
 * this structurally, so callers pass the row directly. */
export interface CouponRules {
  discountType: DiscountType;
  discountValue: MoneyLike; // percent (10.00) or fixed BDT (200.00)
  minOrderAmount: MoneyLike; // min qualifying SUBTOTAL
  totalUsageLimit: number | null; // null = unlimited
  perCustomerLimit: number | null; // null = unlimited
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
}

/**
 * The discount, as a 2dp decimal string, for this coupon against this subtotal.
 * - PERCENTAGE → subtotal * value / 100
 * - FIXED      → value
 * Capped at the subtotal (min), so it never exceeds the subtotal and the
 * resulting total can never go negative. Assumes value > 0 (enforced at
 * coupon creation) so the discount is always ≥ 0.
 */
export function computeDiscount(
  coupon: Pick<CouponRules, "discountType" | "discountValue">,
  subtotal: MoneyLike,
): string {
  const sub = dec(subtotal);
  const value = dec(coupon.discountValue);
  const raw =
    coupon.discountType === "PERCENTAGE" ? sub.times(value).div(100) : value;
  return Decimal.min(raw, sub).toFixed(2);
}

/** Why a coupon can't be applied. NOT_FOUND is produced by the caller (the
 * lookup missed); the rest are decided here from the coupon + context. */
export type CouponFailureReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "BELOW_MIN"
  | "TOTAL_LIMIT_REACHED"
  | "PER_CUSTOMER_LIMIT_REACHED";

/** Customer-friendly messages, keyed by reason. Shared so the validate endpoint
 * and any placement rejection speak with one voice. */
export const COUPON_REASON_MESSAGES: Record<CouponFailureReason, string> = {
  NOT_FOUND: "That coupon code isn't valid.",
  INACTIVE: "This coupon is no longer available.",
  NOT_STARTED: "This coupon isn't active yet.",
  EXPIRED: "This coupon has expired.",
  BELOW_MIN: "Your order doesn't reach the minimum for this coupon.",
  TOTAL_LIMIT_REACHED: "This coupon has reached its usage limit.",
  PER_CUSTOMER_LIMIT_REACHED: "You've already used this coupon.",
};

export type ValidateCouponResult =
  | { ok: true; discount: string }
  | { ok: false; reason: CouponFailureReason; message: string };

/**
 * Decide whether a (found) coupon may be applied to `subtotal` at `now`, given
 * the current redemption counts. On success returns the computed discount.
 * The caller is responsible for the NOT_FOUND case (no coupon to pass here).
 */
export function validateCoupon(params: {
  coupon: CouponRules;
  subtotal: MoneyLike;
  userRedemptionCount: number;
  totalRedemptionCount: number;
  now: Date;
}): ValidateCouponResult {
  const { coupon, subtotal, userRedemptionCount, totalRedemptionCount, now } =
    params;

  const fail = (reason: CouponFailureReason): ValidateCouponResult => ({
    ok: false,
    reason,
    message: COUPON_REASON_MESSAGES[reason],
  });

  if (!coupon.isActive) return fail("INACTIVE");
  if (coupon.validFrom && now < coupon.validFrom) return fail("NOT_STARTED");
  if (coupon.validUntil && now > coupon.validUntil) return fail("EXPIRED");
  if (dec(subtotal).lessThan(dec(coupon.minOrderAmount))) return fail("BELOW_MIN");
  if (coupon.totalUsageLimit !== null && totalRedemptionCount >= coupon.totalUsageLimit) {
    return fail("TOTAL_LIMIT_REACHED");
  }
  if (coupon.perCustomerLimit !== null && userRedemptionCount >= coupon.perCustomerLimit) {
    return fail("PER_CUSTOMER_LIMIT_REACHED");
  }

  return { ok: true, discount: computeDiscount(coupon, subtotal) };
}
