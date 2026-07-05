// Zod validation schemas for the customer account area (Phase B.3).
//
// Reuses the field rules from auth.ts (name, phone, password policy) so the
// account forms and the registration form can never drift apart. Used by both
// the client forms (zodResolver) and the account service (server-side
// re-validation) — same single-source-of-truth pattern as auth.ts.

import { z } from "zod";
import { nameSchema, passwordSchema, phoneSchema } from "@/lib/validations/auth";

/** Profile edit: name is required, phone stays optional (same as registration —
 * the form maps an empty phone input to `undefined` before validation). */
export const updateProfileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional(),
});

/**
 * Password change. `currentPassword` only needs to be present — its real check
 * is the bcrypt comparison in the service. `newPassword` gets the full policy
 * (8–128 chars + common-password blocklist). The two `.refine` checks run after
 * the field rules pass and attach their error to a specific field via `path`,
 * so the form can show them inline.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

// Inferred TypeScript types — import these instead of hand-writing shapes.
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
