// Zod validation schemas for the cart (Phase C.1).
//
// Quantity is capped at 5 per line item everywhere (guest add, server add,
// update, merge). The schemas reject out-of-range values at the API boundary;
// the service layer additionally clamps when summing (existing + added > 5
// clamps to 5 rather than erroring — see cart-service).

import { z } from "zod";

/** Max units of a single product per cart line. */
export const CART_ITEM_MAX_QUANTITY = 5;

const quantitySchema = z
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(CART_ITEM_MAX_QUANTITY, `Maximum ${CART_ITEM_MAX_QUANTITY} per item`);

export const addToCartSchema = z.object({
  productId: z.string().cuid("Invalid product id"),
  quantity: quantitySchema,
});

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

/** Guest-cart merge payload sent right after login/register. */
export const mergeCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid("Invalid product id"),
        quantity: quantitySchema,
      }),
    )
    .max(50, "Too many items"),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
