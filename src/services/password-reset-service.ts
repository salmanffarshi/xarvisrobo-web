// Password-reset service — the business logic for the forgot/reset-password
// flow. Per ADR-003, all rules + DB writes + the email send live here; the API
// routes are thin glue. Auth-sensitive: token handling is the whole point.
//
// Token security model:
//   - The token in the email link is 32 cryptographically-random bytes
//     (base64url). It is a bearer credential — whoever holds it can reset.
//   - The DB stores ONLY sha256(token). A DB leak yields hashes, not working
//     links. We verify by hashing the incoming token and matching the hash.
//     (sha256, not bcrypt: a 32-byte random token has full entropy and isn't
//     brute-forceable, so it needs no slow/salted hash the way a low-entropy
//     human password does.)
//   - Tokens are single-use (usedAt) and expire 24h after creation.

import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { emailSchema, passwordSchema } from "@/lib/validations/auth";
import { sendEmail } from "@/lib/email/client";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";

/** 24 hours, in milliseconds. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Base URL for the reset link. In dev this is localhost; Phase J sets the real one. */
const APP_URL =
  process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * Generic error for any unusable reset token (not found, expired, or already
 * used). One error type so the API returns ONE opaque message — we never tell
 * the caller which of the three it was.
 */
export class InvalidResetTokenError extends Error {
  constructor() {
    super("This reset link is invalid or has expired.");
    this.name = "InvalidResetTokenError";
  }
}

/** sha256(token) as a hex string — what we store and look up by. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Step 1 of the flow. Look up the email; if it belongs to an active CUSTOMER,
 * mint a fresh single-use token and email the reset link. Returns nothing and
 * behaves identically whether or not the email exists — enumeration protection:
 * the caller (and thus the API response) cannot tell a registered email from an
 * unregistered one.
 */
export async function requestReset(rawEmail: string): Promise<void> {
  // Normalize exactly like registration/login so lookups match (trim + lowercase).
  // An invalid email string simply matches no user — still a silent no-op.
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return;
  const email = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.role !== "CUSTOMER" || !user.isActive) {
    // Do nothing, but return the same way — no existence tell.
    return;
  }

  // Invalidate any prior unused tokens for this user before issuing a new one,
  // so only the newest link ever works.
  await db.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  // The plaintext token lives ONLY in this link — never stored, never logged.
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const { subject, html, text } = passwordResetEmail({
    resetUrl,
    name: user.name,
  });

  // sendEmail never throws and returns only { ok }, so a delivery failure can't
  // leak back to the caller as a different response.
  await sendEmail({ to: user.email, subject, html, text });
}

/**
 * Step 2 of the flow. Redeem a token and set the new password. Throws
 * InvalidResetTokenError (opaque) for a missing/expired/used token. Validates
 * the new password with the shared passwordSchema. Marks the token used and
 * clears any other outstanding tokens for the user, all in one transaction.
 * Does NOT sign the user in — the UI sends them to /login afterward.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    throw new InvalidResetTokenError();
  }

  // Enforce the password policy defensively (the API validates first).
  const password = passwordSchema.parse(newPassword);
  const passwordHash = await bcrypt.hash(password, 12);

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Drop every other outstanding token for this user (used one already flagged
    // above) so no stale link survives the reset.
    db.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);
}
