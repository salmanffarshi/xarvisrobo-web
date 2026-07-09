// Zod validation for customer-submitted payment proof (Phase D.2).
//
// The customer identifies their prepaid payment (bKash/Nagad) by transaction
// ID + sender number; the amount is fixed and already communicated, so it's not
// collected (D.2 amendment). The URL, if present, is only shape-checked here;
// the service re-validates that it's actually on our Cloudinary cloud/folder
// before storing it (isOwnCloudinaryUrl).

import { z } from "zod";

import { phoneSchema } from "@/lib/validations/auth";

export const submitProofSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(3, "Transaction ID looks too short")
    .max(64, "Transaction ID looks too long"),
  senderNumber: phoneSchema,
  screenshotUrl: z.string().url("Invalid screenshot URL").optional(),
});

export type SubmitProofInput = z.infer<typeof submitProofSchema>;
