// Auth service — business logic for account creation.
//
// Per ADR-003 / architecture principle 4, all rules and DB writes live here, not
// in the route handler. The future mobile app hits the same /api/v1 route, which
// calls this function, so the behavior is defined exactly once.

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

/** Thrown when the email is already registered. Mapped to HTTP 409 by the route. */
export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailTakenError";
  }
}

/** Thrown when the phone number is already registered. Mapped to HTTP 409. */
export class PhoneTakenError extends Error {
  constructor() {
    super("Phone number already registered");
    this.name = "PhoneTakenError";
  }
}

export type RegisteredCustomer = {
  id: string;
  name: string;
  email: string;
};

/**
 * Create a new CUSTOMER account. Re-validates the input defensively so the
 * service is safe to call on its own, hashes the password with bcrypt, and
 * maps unique-constraint violations to typed errors the route can translate
 * into clean 409 responses. Never returns the password hash.
 */
export async function registerCustomer(
  input: RegisterInput
): Promise<RegisteredCustomer> {
  // Defensive re-parse: also normalizes email (lowercased/trimmed) even if a
  // caller skipped the route-level validation.
  const { name, email, password, phone } = registerSchema.parse(input);

  // Fast path: a clear, friendly error before we attempt the insert.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new EmailTakenError();
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    return await db.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        passwordHash,
        role: "CUSTOMER",
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    // Handles the race where two requests pass the findUnique check at once, and
    // the case where the phone (also @unique) collides with another account.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes("phone")) {
        throw new PhoneTakenError();
      }
      throw new EmailTakenError();
    }
    throw error;
  }
}
