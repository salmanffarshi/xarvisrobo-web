// Zod validation schema for customer addresses (Phase B.3).
//
// Fields mirror the Prisma `Address` model exactly (minus id/userId/timestamps,
// which the server controls). Same single-source-of-truth pattern as auth.ts:
// the client form and the address service both validate with this schema.

import { z } from "zod";
import { BD_DISTRICTS } from "@/lib/data/bd-districts";
import { phoneSchema } from "@/lib/validations/auth";

/**
 * A saved shipping address. `district` stays typed as a plain string (matching
 * the DB column and the form's <select> value) but is only valid if it appears
 * in the hardcoded 64-district list — so a hand-crafted API request can't store
 * an arbitrary district any more than the dropdown can.
 */
export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required (e.g. Home, Office)")
    .max(30, "Label must be at most 30 characters"),
  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name must be at least 2 characters")
    .max(80, "Recipient name must be at most 80 characters"),
  phone: phoneSchema,
  streetAddress: z
    .string()
    .trim()
    .min(3, "Street address must be at least 3 characters")
    .max(200, "Street address must be at most 200 characters"),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(80, "City must be at most 80 characters"),
  district: z
    .string()
    .refine((value) => (BD_DISTRICTS as readonly string[]).includes(value), {
      message: "Select a district",
    }),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter a valid 4-digit postal code"),
  // Optional on the wire (an API client may omit it); the service treats a
  // missing value as false.
  isDefault: z.boolean().optional(),
});

/** Create uses the same shape — the server decides id/userId/timestamps. */
export const createAddressSchema = addressSchema;

// Inferred TypeScript types — import these instead of hand-writing shapes.
export type AddressInput = z.infer<typeof addressSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
