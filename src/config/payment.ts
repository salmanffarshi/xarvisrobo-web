// SEED DEFAULTS ONLY (Phase E.4 Part A) — nothing at runtime reads these.
//
// As of Phase E.4, the payment-receiving details, WhatsApp number, and the two
// COD delivery charges live in the admin-editable Settings row (one per store).
// This file is now ONLY the source of the initial values for that row: the seed
// (prisma/seed.ts) writes them on a fresh DB, and settings-service uses them to
// self-heal a missing singleton. Editing a value here changes only what a fresh
// seed would create — it does NOT change what the live site shows. To change the
// live site, edit the values in /admin/settings.
//
// COD delivery charge depends on the customer's chosen zone (ADR-016): prepaid
// is free everywhere; COD is ৳60 inside Dhaka, ৳130 outside (these two numbers
// are the seed defaults for Settings.codInsideDhaka / codOutsideDhaka).

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
