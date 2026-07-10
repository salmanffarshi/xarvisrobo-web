// Route-level auth guards for /api/v1/* handlers (Phase B.3).
//
// `requireCustomer()` is the single gate every customer-only API route calls
// first. It returns EITHER a verified customer session OR a ready-made 401
// response — never both — so a handler stays two lines:
//
//   const guard = await requireCustomer();
//   if (guard.response) return guard.response;
//   // guard.session is now a signed-in CUSTOMER session
//
// The union is discriminated (each variant marks the other key `never`), so
// after the `if` TypeScript knows `guard.session` exists — no `!` needed.

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { isCustomer, isStaff } from "@/lib/permissions";

type CustomerGuard =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

type StaffGuard =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

/**
 * Verify the request carries a signed-in CUSTOMER session. Staff sessions are
 * rejected too (per ADR-002's intent: an admin session never grants customer
 * commerce actions). The 401 body uses the standard error envelope.
 */
export async function requireCustomer(): Promise<CustomerGuard> {
  const session = await auth();
  if (!session?.user || !isCustomer(session.user.role)) {
    return {
      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in as a customer.",
          },
        },
        { status: 401 }
      ),
    };
  }
  return { session };
}

/**
 * API counterpart to `requireCustomer`, for `/api/v1/admin/*` handlers (Phase
 * E.1). Verifies the request carries a signed-in STAFF session (any non-CUSTOMER
 * role — ADMIN-only in v1, but the predicate stays role-agnostic). Customer
 * sessions are rejected (ADR-002: a customer session never grants admin access).
 * Returns EITHER the session OR a ready-made 401 — same two-line handler pattern.
 * This is the per-route belt on top of the middleware suspenders.
 */
export async function requireStaff(): Promise<StaffGuard> {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    return {
      response: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "You must be signed in as staff.",
          },
        },
        { status: 401 }
      ),
    };
  }
  return { session };
}

/**
 * Page/layout counterpart of `requireStaff`, for admin server components (Phase
 * E.1). Redirects to `/admin/login` when the visitor is unauthenticated or not
 * staff; otherwise returns the verified staff session. Used by the admin shell
 * layout as defense-in-depth on top of the middleware gate.
 */
export async function requireStaffPage(): Promise<Session> {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    redirect("/admin/login");
  }
  return session;
}
