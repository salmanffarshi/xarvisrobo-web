// REPLACE BEFORE LAUNCH — every PLACEHOLDER_* value below must be swapped for
// the real receiving account details before real customers use the site.
//
// Payment receiving details shown to customers on the order confirmation page
// (Phase C.2). Single source of truth: the confirmation page reads from here,
// and Phase E makes these admin-editable. These are public-facing (customers
// must see them to pay) — they are not secrets, but keep them accurate.
// The COD delivery charge is locked at 130 BDT per ADR-009.

export const CURRENCY = "BDT";
export const COD_DELIVERY_CHARGE = 130; // ADR-009

export type PrepaidMethod = "BKASH" | "NAGAD" | "BANK";

export interface MobileWalletDetails {
  accountType: "personal" | "merchant";
  number: string;
  instructions?: string;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  routingNumber?: string;
  instructions?: string;
}

export const paymentReceivingDetails: {
  BKASH: MobileWalletDetails;
  NAGAD: MobileWalletDetails;
  BANK: BankDetails;
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
  BANK: {
    bankName: "PLACEHOLDER_Bank Name",
    accountName: "PLACEHOLDER_Xarvisrobo",
    accountNumber: "PLACEHOLDER_XXXXXXXXXXXX",
    branch: "PLACEHOLDER_Branch name",
    routingNumber: "PLACEHOLDER_optional",
    instructions: undefined,
  },
};

export const paymentGeneralNote =
  "After sending payment, keep your transaction ID. We'll verify your payment " +
  "and confirm your order. Use your order number as the reference when " +
  "sending money.";
