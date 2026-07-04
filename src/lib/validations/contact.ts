// Contact form validation — single source of truth, used by:
//   1. The contact page form (react-hook-form zodResolver).
//   2. The API route (validates the raw request body).
//   3. contact-service.submitMessage (defense-in-depth re-parse, ADR-003).
//
// name/email/phone reuse the auth schemas so "what is a valid email/phone"
// is defined exactly once in the codebase.

import { z } from "zod";

import { emailSchema, nameSchema, phoneSchema } from "@/lib/validations/auth";

export const contactMessageSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  // Optional plain `.optional()` (not `.or(z.literal(""))`) so input/output
  // types match for react-hook-form; the form maps "" → undefined onChange.
  phone: phoneSchema.optional(),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(120, "Subject must be at most 120 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be at most 5000 characters"),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
