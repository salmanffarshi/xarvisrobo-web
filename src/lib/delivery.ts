// Delivery-charge rule (ADR-016). Single source of truth: order-service calls
// this at placement to compute the authoritative charge, and the checkout
// summary calls the SAME function so the displayed charge always matches what
// the server will store.
//
// The zone is an EXPLICIT customer choice (a checkout radio), never derived
// from the address district — so there is no district parsing anywhere here.
//
// No float math: the constants are whole taka; formatting an integer to 2dp
// is exact, so the decimal strings ("0.00" / "60.00" / "130.00") are precise.

import {
  COD_DELIVERY_INSIDE_DHAKA,
  COD_DELIVERY_OUTSIDE_DHAKA,
} from "@/config/payment";
import type { DeliveryZone, PaymentMethod } from "@prisma/client";

/** Customer-facing zone labels, from the stored enum (ADR-016). */
export const DELIVERY_ZONE_LABELS: Record<DeliveryZone, string> = {
  INSIDE_DHAKA: "Inside Dhaka",
  OUTSIDE_DHAKA: "Outside Dhaka",
};

/**
 * Delivery charge as a 2dp decimal string, from payment method + chosen zone:
 * - prepaid (BKASH/NAGAD/BANK) → "0.00" (free everywhere)
 * - COD + INSIDE_DHAKA  → "60.00"
 * - COD + OUTSIDE_DHAKA → "130.00"
 */
export function computeDeliveryCharge(
  paymentMethod: PaymentMethod,
  deliveryZone: DeliveryZone,
): string {
  if (paymentMethod !== "COD") {
    return "0.00";
  }
  const charge =
    deliveryZone === "INSIDE_DHAKA"
      ? COD_DELIVERY_INSIDE_DHAKA
      : COD_DELIVERY_OUTSIDE_DHAKA;
  return charge.toFixed(2);
}
