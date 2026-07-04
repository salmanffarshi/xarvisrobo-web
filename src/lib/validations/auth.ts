// Zod validation schemas for authentication flows.
//
// These schemas are the SINGLE SOURCE OF TRUTH for what a valid name, email,
// password, and phone number look like. They are used in three places so the
// rules can never drift apart:
//   1. Client-side forms  — via react-hook-form's zodResolver.
//   2. Server API routes   — the register endpoint re-validates the body.
//   3. Credentials.authorize / create-admin CLI — validate before DB access.
//
// Password policy is NIST-modern (see common-passwords.ts): length bounds plus
// a common-password blocklist, with NO composition rules.

import { z } from "zod";
import { isCommonPassword } from "@/lib/validations/common-passwords";

/**
 * Password: 8–128 characters, rejected if it appears on the common-passwords
 * blocklist. No forced uppercase/number/symbol (NIST SP 800-63B guidance).
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((pw) => !isCommonPassword(pw), {
    message: "This password is too common — please choose a stronger one.",
  });

/**
 * Email: trimmed and lowercased BEFORE validation, so "  Foo@Bar.com " becomes
 * "foo@bar.com". Lowercasing here keeps email uniqueness consistent in the DB.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address" }));

/**
 * Display name: 2–80 characters after trimming surrounding whitespace.
 */
export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be at most 80 characters");

/**
 * Bangladesh mobile number: 11 digits starting with "01" (e.g. 01712345678).
 * Optional at registration — we only require it later at checkout.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^01\d{9}$/, "Enter a valid Bangladesh phone number (e.g. 01712345678)");

/** Customer self-registration payload. */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  // Optional at registration. Kept as a plain optional so the schema's input
  // and output types match exactly (react-hook-form's zod resolver typing needs
  // that). The register form maps an empty phone input to `undefined` in the
  // field's onChange, so a blank optional phone never reaches this regex.
  phone: phoneSchema.optional(),
});

/** Customer login payload. Password only needs to be present here — the real
 * strength check happened at registration; login just verifies the hash. */
export const customerLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/** Admin/staff login payload. Same shape as customer login today, but kept as a
 * separate schema so we can add staff-only fields (e.g. 2FA token) later
 * without touching the customer form. */
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Inferred TypeScript types — import these instead of hand-writing shapes.
export type RegisterInput = z.infer<typeof registerSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
