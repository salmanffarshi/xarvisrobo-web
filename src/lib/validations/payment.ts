// Zod validation for customer-submitted payment proof (Phase D.2).
//
// The customer reports what they paid for a prepaid order (bKash/Nagad/bank).
// paidAmount stays a STRING all the way to Prisma's Decimal column so we don't
// lose precision through a float (the money-on-the-wire convention). The URL,
// if present, is only shape-checked here; the service re-validates that it's
// actually on our Cloudinary cloud/folder before storing it (isOwnCloudinaryUrl).

import { z } from "zod";

import { phoneSchema } from "@/lib/validations/auth";

export const submitProofSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(3, "Transaction ID looks too short")
    .max(64, "Transaction ID looks too long"),
  senderNumber: phoneSchema,
  paidAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1250 or 1250.00)")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  screenshotUrl: z.string().url("Invalid screenshot URL").optional(),
});

export type SubmitProofInput = z.infer<typeof submitProofSchema>;
