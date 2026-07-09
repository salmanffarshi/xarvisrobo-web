// REPLACE BEFORE LAUNCH — every PLACEHOLDER_* value below must be swapped for
// the real receiving account details before real customers use the site.
//
// Payment receiving details shown to customers on the order confirmation page
// (Phase C.2). Single source of truth: the confirmation page reads from here,
// and Phase E makes these admin-editable. These are public-facing (customers
// must see them to pay) — they are not secrets, but keep them accurate.
// COD delivery charge depends on the customer's chosen zone (ADR-016):
// prepaid is free everywhere; COD is ৳60 inside Dhaka, ৳130 outside.

export const CURRENCY = "BDT";
export const COD_DELIVERY_INSIDE_DHAKA = 60; // ADR-016
export const COD_DELIVERY_OUTSIDE_DHAKA = 130; // ADR-016

// Business WhatsApp number in international format, digits only (no +, no
// spaces) — the form wa.me/<number> requires. Used for the payment-proof and
// COD-confirmation handoffs (Phase D.2). Admin-editable in Phase E.
// REPLACE BEFORE LAUNCH — this is a placeholder, not the real number.
export const WHATSAPP_NUMBER = "8801XXXXXXXXX";

export type PrepaidMethod = "BKASH" | "NAGAD";

export interface MobileWalletDetails {
  accountType: "personal" | "merchant";
  number: string;
  instructions?: string;
}

export const paymentReceivingDetails: {
  BKASH: MobileWalletDetails;
  NAGAD: MobileWalletDetails;
} = {
  BKASH: {
    accountType: "personal",
    number: "PLACEHOLDER_01XXXXXXXXX",
    instructions: "Use 'Send Money', not 'Payment'.",
  },
  NAGAD: {
    accountType: "personal",
    number: "PLACEHOLDER_01XXXXXXXXX",
    instructions: "Use 'Send Money', not 'Payment'.",
  },
};

export const paymentGeneralNote =
  "After sending payment, keep your transaction ID. We'll verify your payment " +
  "and confirm your order. Use your order number as the reference when " +
  "sending money.";
