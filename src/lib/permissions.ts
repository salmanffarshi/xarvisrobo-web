// Role-based access helpers.
//
// Per CLAUDE.md architecture principle 3, we never hardcode `isAdmin` checks
// scattered through the codebase. All role logic funnels through this file so
// there is exactly one place that defines what each role can do.
//
// Two kinds of helpers:
//   - Predicates (isCustomer, isStaff, ...) return a boolean. Use in `if`s and
//     in middleware where we branch on role.
//   - Assertions (assertStaff, assertAdmin) THROW when the check fails. Use at
//     the top of service functions so a wrong-role caller can never proceed;
//     TypeScript also narrows `session` to non-null after a passing assertion.

import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

/** True only for the CUSTOMER role. */
export function isCustomer(role: UserRole): boolean {
  return role === "CUSTOMER";
}

/** True for any staff role (everything except CUSTOMER). */
export function isStaff(role: UserRole): boolean {
  return role !== "CUSTOMER";
}

/** True only for the top-level ADMIN role. */
export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

/** True for ADMIN or MANAGER — the two roles allowed to manage most resources. */
export function isAdminOrManager(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Throws unless `session` belongs to a signed-in staff member. On success,
 * TypeScript narrows `session` to a non-null `Session` for the caller.
 */
export function assertStaff(session: Session | null): asserts session is Session {
  if (!session?.user || !isStaff(session.user.role)) {
    throw new Error("Forbidden: staff access required");
  }
}

/**
 * Throws unless `session` belongs to a signed-in ADMIN. On success, TypeScript
 * narrows `session` to a non-null `Session` for the caller.
 */
export function assertAdmin(session: Session | null): asserts session is Session {
  if (!session?.user || !isAdmin(session.user.role)) {
    throw new Error("Forbidden: admin access required");
  }
}
