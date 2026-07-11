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

import type { DeliveryZone, PaymentMethod } from "@prisma/client";

/** Customer-facing zone labels, from the stored enum (ADR-016). */
export const DELIVERY_ZONE_LABELS: Record<DeliveryZone, string> = {
  INSIDE_DHAKA: "Inside Dhaka",
  OUTSIDE_DHAKA: "Outside Dhaka",
};

/** The two whole-taka COD charges, read from the Settings row (Phase E.4). */
export type CodCharges = {
  insideDhaka: number;
  outsideDhaka: number;
};

/**
 * Delivery charge as a 2dp decimal string, from payment method + chosen zone.
 * The LOGIC is fixed (ADR-016); only the two COD NUMBERS are supplied by the
 * caller (from the Settings row):
 * - prepaid (BKASH/NAGAD) → "0.00" (free everywhere)
 * - COD + INSIDE_DHAKA  → insideDhaka
 * - COD + OUTSIDE_DHAKA → outsideDhaka
 */
export function computeDeliveryCharge(
  paymentMethod: PaymentMethod,
  deliveryZone: DeliveryZone,
  charges: CodCharges,
): string {
  if (paymentMethod !== "COD") {
    return "0.00";
  }
  const charge =
    deliveryZone === "INSIDE_DHAKA"
      ? charges.insideDhaka
      : charges.outsideDhaka;
  return charge.toFixed(2);
}
