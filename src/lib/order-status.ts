// Customer-facing order-status presentation (ADR-016). Single source of truth
// for how a status reads and how its badge is toned — used on the confirmation
// page now, and reused by the Phase D/E order views. Manufacturing internals
// are never surfaced here (ADR-006).

import type { OrderStatus } from "@prisma/client";

/** Human-readable labels, verbatim from ADR-016. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  WAITING_FOR_PAYMENT: "Waiting for Payment",
  WAITING_FOR_PAYMENT_VERIFICATION: "Waiting for Payment Verification",
  PAYMENT_VERIFIED: "Payment Verified",
  WAITING_FOR_ORDER_CONFIRMATION: "Waiting for Order Confirmation",
  ORDER_CONFIRMED: "Order Confirmed",
  IN_PRODUCTION: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Coarse tone for subtly coloring a status badge, kept within the site's
 * restrained palette (pending→amber, progress→blue, success→green,
 * terminal→neutral). The caller maps the token to classes.
 */
export type StatusTone = "pending" | "progress" | "success" | "terminal";

export function statusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case "WAITING_FOR_PAYMENT":
    case "WAITING_FOR_PAYMENT_VERIFICATION":
    case "WAITING_FOR_ORDER_CONFIRMATION":
      return "pending";
    case "PAYMENT_VERIFIED":
    case "ORDER_CONFIRMED":
    case "IN_PRODUCTION":
    case "SHIPPED":
      return "progress";
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "terminal";
  }
}
