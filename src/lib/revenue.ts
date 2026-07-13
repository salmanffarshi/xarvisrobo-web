// Recognized-revenue predicate (Phase F) — the SINGLE SOURCE OF TRUTH for which
// orders count toward revenue. Revenue is DERIVED, not a stored flag: an order
// contributes IFF its Payment is VERIFIED and the order is neither RETURNED nor
// CANCELLED. This where-clause is the ONE place that rule lives, reused by every
// revenue query so the dashboard is always consistent with current state.
//
//   - Prepaid: Payment → VERIFIED at the verification gate → counts from
//     PAYMENT_VERIFIED onward.
//   - COD: Payment is PENDING until delivery; marking COD Delivered flips it to
//     VERIFIED → counts at delivered.
//   - RETURNED / CANCELLED: excluded by status → revenue reverses automatically,
//     identically for prepaid and COD; the order record is kept.
//
// `payment` is an optional 1-1 relation, but every order gets a PENDING Payment
// at placement (ADR-016), so the relation filter is safe.

import type { Prisma } from "@prisma/client";

export const REVENUE_ORDER_WHERE: Prisma.OrderWhereInput = {
  payment: { is: { status: "VERIFIED" } },
  status: { notIn: ["RETURNED", "CANCELLED"] },
};
