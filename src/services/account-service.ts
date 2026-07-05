// Account service — business logic for the customer's own profile (Phase B.3).
//
// Per ADR-003, all rules and DB writes live here, not in the /api/v1/me route
// handlers. The future mobile app hits the same routes, which call these
// functions, so the behavior is defined exactly once.

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@/lib/validations/account";
import { PhoneTakenError } from "@/services/auth-service";

/** Thrown when the supplied current password doesn't match. Mapped to HTTP 400
 * by the route — with a generic message so it can't be used to probe hashes. */
export class InvalidCurrentPasswordError extends Error {
  readonly code = "INVALID_CURRENT_PASSWORD";
  constructor() {
    super("Current password is incorrect");
    this.name = "InvalidCurrentPasswordError";
  }
}

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
};

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** The customer's own profile. Never selects the passwordHash. */
export async function getProfile(userId: string): Promise<Profile> {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: profileSelect,
  });
}

/**
 * Update name + phone. The form always submits the full profile, so an omitted
 * phone means "cleared" and is stored as null. A phone that collides with
 * another account's (phone is @unique) maps to PhoneTakenError → HTTP 409.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<Profile> {
  const { name, phone } = updateProfileSchema.parse(input);

  try {
    return await db.user.update({
      where: { id: userId },
      data: { name, phone: phone ?? null },
      select: profileSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PhoneTakenError();
    }
    throw error;
  }
}

/**
 * Change password: verify the current password against the stored bcrypt hash,
 * then store the new one. Per ADR-014 (JWT sessions) there are no DB sessions
 * to invalidate — the user stays logged in on this device by design.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput
): Promise<{ success: true }> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  // passwordHash is nullable in the schema (future OAuth accounts). No hash
  // means the current password can't possibly match.
  const matches =
    user.passwordHash !== null &&
    (await bcrypt.compare(currentPassword, user.passwordHash));
  if (!matches) {
    throw new InvalidCurrentPasswordError();
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true };
}
