// Zod validation for admin coupon management (Phase E.5). System boundary —
// admin input is validated here before the service writes it. The code is
// normalized to UPPERCASE (stored + matched case-insensitively, ADR-017).
//
// Cross-field rules: a PERCENTAGE discount can't exceed 100; valid-until must
// be after valid-from when both are set. These are guarded for presence so the
// same rules apply cleanly to the all-optional update variant.

import { z } from "zod";

const couponFields = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters")
    .max(40)
    .transform((c) => c.toUpperCase()),
  description: z.string().trim().max(200).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive("Discount value must be greater than 0"),
  minOrderAmount: z.number().min(0, "Minimum order can't be negative").optional(),
  // null = unlimited; if a limit is set it must be at least 1.
  totalUsageLimit: z.number().int().min(1, "Limit must be at least 1").nullable().optional(),
  perCustomerLimit: z.number().int().min(1, "Limit must be at least 1").nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validUntil: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

type CouponShape = z.infer<typeof couponFields>;

// Guarded so the rules also hold when a field is absent (update/partial).
const percentageRule = (d: Partial<CouponShape>) =>
  d.discountType !== "PERCENTAGE" ||
  d.discountValue === undefined ||
  d.discountValue <= 100;

const dateRangeRule = (d: Partial<CouponShape>) =>
  !(d.validFrom && d.validUntil) || d.validUntil > d.validFrom;

export const createCouponSchema = couponFields
  .refine(percentageRule, {
    message: "A percentage discount can't exceed 100.",
    path: ["discountValue"],
  })
  .refine(dateRangeRule, {
    message: "Valid-until must be after valid-from.",
    path: ["validUntil"],
  });

export const updateCouponSchema = couponFields
  .partial()
  .refine(percentageRule, {
    message: "A percentage discount can't exceed 100.",
    path: ["discountValue"],
  })
  .refine(dateRangeRule, {
    message: "Valid-until must be after valid-from.",
    path: ["validUntil"],
  });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
