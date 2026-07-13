// Order-action transition rules (Phase E.2.2) — the SINGLE SOURCE OF TRUTH for
// which admin actions are legal on an order in a given state. Both the server
// guards (order-actions-service.ts) and the admin UI (the action panel) derive
// from THIS file, so the buttons shown can never diverge from what the service
// enforces.
//
// Pure logic only — NO Prisma / `db` import. That's deliberate: the client
// action panel imports `legalNextActions` directly, and pulling the service
// module (which imports Prisma) into a client component would bundle Prisma
// into the browser. Keeping the rules here, database-free, is the standard
// Next.js split.

import type { OrderStatus, PaymentMethod } from "@prisma/client";

/** Every admin action E.2.2 exposes on an order. */
export type OrderAction =
  | "VERIFY_PAYMENT"
  | "REJECT_PAYMENT"
  | "CONFIRM_COD"
  | "START_PRODUCTION"
  | "MARK_SHIPPED"
  | "MARK_DELIVERED"
  | "MARK_RETURNED"
  | "CANCEL";

/**
 * The ONLY definition of legal guided status advancement (from → to). Used both
 * to validate `advanceStatus` server-side and to derive which advance button
 * (if any) the UI offers. Gate transitions (verify/reject/confirm) and cancel
 * are NOT advancement — they live in their own rules below.
 */
export const ADVANCE_MAP: Partial<Record<OrderStatus, OrderStatus>> = {
  PAYMENT_VERIFIED: "IN_PRODUCTION",
  ORDER_CONFIRMED: "IN_PRODUCTION",
  IN_PRODUCTION: "SHIPPED",
  SHIPPED: "DELIVERED",
};

/**
 * States a non-terminal, pre-SHIPPED order can be cancelled from. Cancelling is
 * blocked from SHIPPED / DELIVERED / CANCELLED (a shipped order can't be pulled
 * back; delivered and cancelled are terminal).
 */
export const CANCELLABLE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "WAITING_FOR_PAYMENT",
  "WAITING_FOR_PAYMENT_VERIFICATION",
  "PAYMENT_VERIFIED",
  "WAITING_FOR_ORDER_CONFIRMATION",
  "ORDER_CONFIRMED",
  "IN_PRODUCTION",
]);

/**
 * States an order can be marked RETURNED from (Phase F). SHIPPED covers a
 * refused-on-delivery return; DELIVERED covers a post-delivery return. Marking
 * returned reverses revenue via the predicate while keeping the order record.
 * DELIVERED is therefore no longer fully terminal.
 */
export const RETURNABLE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "SHIPPED",
  "DELIVERED",
]);

/** Prepaid methods (bKash / Nagad). COD is the only non-prepaid method. */
function isPrepaid(method: PaymentMethod): boolean {
  return method !== "COD";
}

/** Maps an advancement target to the action that performs it. */
function advanceActionFor(toStatus: OrderStatus): OrderAction {
  switch (toStatus) {
    case "IN_PRODUCTION":
      return "START_PRODUCTION";
    case "SHIPPED":
      return "MARK_SHIPPED";
    default:
      // Only DELIVERED remains as an ADVANCE_MAP target.
      return "MARK_DELIVERED";
  }
}

/**
 * The legal actions for an order in its current state — the authority the UI
 * renders buttons from and the service guards check against. Returned in a
 * sensible display order (primary transitions first, CANCEL last).
 */
export function legalNextActions({
  status,
  paymentMethod,
}: {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
}): OrderAction[] {
  const actions: OrderAction[] = [];

  // Payment gate (prepaid) — verify or reject the submitted proof.
  if (isPrepaid(paymentMethod) && status === "WAITING_FOR_PAYMENT_VERIFICATION") {
    actions.push("VERIFY_PAYMENT", "REJECT_PAYMENT");
  }

  // COD confirmation gate.
  if (paymentMethod === "COD" && status === "WAITING_FOR_ORDER_CONFIRMATION") {
    actions.push("CONFIRM_COD");
  }

  // Guided advancement (start production / ship / deliver).
  const advanceTarget = ADVANCE_MAP[status];
  if (advanceTarget) {
    actions.push(advanceActionFor(advanceTarget));
  }

  // Cancel, from any non-terminal pre-SHIPPED state.
  if (CANCELLABLE_STATUSES.has(status)) {
    actions.push("CANCEL");
  }

  // Return, from SHIPPED (refused) or DELIVERED (post-delivery).
  if (RETURNABLE_STATUSES.has(status)) {
    actions.push("MARK_RETURNED");
  }

  return actions;
}
