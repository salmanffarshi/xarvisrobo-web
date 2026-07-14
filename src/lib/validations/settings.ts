// Zod validation for the admin Settings editor (Phase E.4 Part A).
//
// System boundary: these values become customer-facing payment instructions and
// the two COD delivery charges, so they're validated here where admin input
// enters the system. The delivery-charge LOGIC stays in code (ADR-016) — only
// the two whole-taka NUMBERS are edited.

import { z } from "zod";

const accountType = z.enum(["personal", "merchant"]);

// Receiving-account number shown to customers (bKash/Nagad). Kept a lenient
// non-empty string, not a strict phone regex, because it may be a personal or
// merchant number and starts life as a placeholder to be replaced before launch.
const receivingNumber = z
  .string()
  .trim()
  .min(1, "Required")
  .max(40, "Too long");

const instructions = z
  .string()
  .trim()
  .max(500, "Keep instructions under 500 characters")
  .optional();

// Whole, non-negative taka. The delivery charge must never go negative.
const codCharge = z
  .number({ message: "Enter a number" })
  .int("Whole taka only")
  .min(0, "Cannot be negative")
  .max(100000, "Unreasonably large");

export const updateSettingsSchema = z.object({
  bkashNumber: receivingNumber,
  bkashType: accountType,
  bkashInstructions: instructions,
  nagadNumber: receivingNumber,
  nagadType: accountType,
  nagadInstructions: instructions,
  // International format, digits only (no +, no spaces) — wa.me/<number> needs it.
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Digits only, international format (e.g. 8801712345678)"),
  // Facebook Messenger link (e.g. https://m.me/yourpage). Optional; blank means
  // "hide the Messenger button". If present, it must be a valid http(s) URL.
  messengerUrl: z
    .string()
    .trim()
    .max(500, "Keep the link under 500 characters")
    .refine(
      (v) => v === "" || /^https?:\/\/.+/i.test(v),
      "Enter a valid link starting with http:// or https://",
    )
    .optional(),
  codInsideDhaka: codCharge,
  codOutsideDhaka: codCharge,
  paymentGeneralNote: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1000 characters")
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
