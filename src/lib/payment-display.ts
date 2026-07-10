// Admin-facing payment presentation (Phase E.2.1). Display labels + badge tone
// for PaymentMethod and PaymentStatus, so the raw enum values (BKASH,
// INFO_REQUESTED, …) never reach the screen. Used by the admin order list +
// detail pages.

import type { PaymentMethod, PaymentStatus } from "@prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  COD: "Cash on Delivery",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  INFO_REQUESTED: "Info Requested",
};

/** Badge classes per payment status, in the site's restrained palette. */
export const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  VERIFIED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  INFO_REQUESTED: "bg-blue-50 text-blue-700",
};
