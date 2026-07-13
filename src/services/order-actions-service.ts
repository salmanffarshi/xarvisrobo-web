// Admin order-action layer (Phase E.2.2, ADR-003). The mutating counterpart to
// the read functions in order-service.ts: verify/reject payment, confirm a COD
// order, advance the customer-facing status through its guided steps, and
// cancel. Every function:
//
//   - assumes the caller is already staff (routes call requireStaff — these do
//     no auth themselves), and takes the acting adminId for attribution;
//   - runs in a single prisma.$transaction so the from-state check and the
//     writes are atomic (no two concurrent verifies both slip through);
//   - validates the CURRENT status before mutating (from-state guard);
//   - appends an OrderStatusHistory row with changedById = adminId;
//   - returns { orderNumber, status } — the new status. No money is recomputed
//     (totals are locked at placement, ADR-005).
//
// MANUFACTURING GATES (ADR-016): the Manufacturing row is created at EXACTLY two
// points — verifyPayment and confirmCodOrder — and nowhere else. The from-state
// guard is what makes each gate fire once (the transition leaves the state that
// permits it, so a second call fails the guard). A redundant existence assert
// backs that against data corruption; Manufacturing.orderId is @unique at the DB.
//
// The legal-transition rules live in src/lib/order-actions.ts and are shared
// with the UI, so the buttons rendered never diverge from what these guards
// enforce.

import { db } from "@/lib/db";
import {
  ADVANCE_MAP,
  CANCELLABLE_STATUSES,
  legalNextActions,
} from "@/lib/order-actions";

import type { OrderStatus } from "@prisma/client";

/** Order not found by orderNumber. Mapped to HTTP 404. */
export class OrderNotFoundError extends Error {
  readonly code = "ORDER_NOT_FOUND";
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

/** The action isn't legal for the order's current state (wrong from-state, wrong
 * method). Mapped to HTTP 409. */
export class InvalidStateError extends Error {
  readonly code = "INVALID_STATE";
  constructor(message = "This action is not allowed for the order's current status") {
    super(message);
    this.name = "InvalidStateError";
  }
}

/** A status-advance whose (from, to) pair isn't a legal step. HTTP 409. */
export class InvalidTransitionError extends Error {
  readonly code = "INVALID_TRANSITION";
  constructor() {
    super("That status transition is not allowed");
    this.name = "InvalidTransitionError";
  }
}

/** A required reason (reject / cancel) was empty. HTTP 400. */
export class ReasonRequiredError extends Error {
  readonly code = "REASON_REQUIRED";
  constructor() {
    super("A reason is required");
    this.name = "ReasonRequiredError";
  }
}

/** What every action returns: the order and its new customer-facing status. */
export interface OrderActionResult {
  orderNumber: string;
  status: OrderStatus;
}

/**
 * Verify a prepaid payment (GATE). From WAITING_FOR_PAYMENT_VERIFICATION →
 * PAYMENT_VERIFIED, marks the Payment VERIFIED (attributed to the admin), and
 * CREATES the Manufacturing row (WAITING_FOR_PRODUCTION) — the first of the two
 * production gates.
 */
export async function verifyPayment(
  adminId: string,
  orderNumber: string,
): Promise<OrderActionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        payment: { select: { id: true } },
        manufacturing: { select: { id: true } },
      },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Shared rule with the UI: VERIFY_PAYMENT must be a legal action here.
    if (
      !legalNextActions(order).includes("VERIFY_PAYMENT") ||
      !order.payment
    ) {
      throw new InvalidStateError();
    }

    // Invariant: reaching this gate with a Manufacturing row already present
    // means the from-state guard was bypassed — corruption, never expected.
    if (order.manufacturing) {
      throw new Error(
        `Invariant violation: order ${orderNumber} already has a Manufacturing row at payment verification`,
      );
    }

    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: "VERIFIED", verifiedById: adminId, verifiedAt: new Date() },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_VERIFIED" },
    });

    // GATE: production work now exists. internalStatus defaults to
    // WAITING_FOR_PRODUCTION (schema default).
    await tx.manufacturing.create({ data: { orderId: order.id } });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "WAITING_FOR_PAYMENT_VERIFICATION",
        toStatus: "PAYMENT_VERIFIED",
        changedById: adminId,
        note: "Payment verified",
      },
    });

    return { orderNumber, status: "PAYMENT_VERIFIED" };
  });
}

/**
 * Reject a prepaid payment. From WAITING_FOR_PAYMENT_VERIFICATION back to
 * WAITING_FOR_PAYMENT with the Payment marked REJECTED and the reason stored, so
 * the customer sees why and can resubmit (submitPaymentProof resets it to
 * PENDING). No Manufacturing row.
 */
export async function rejectPayment(
  adminId: string,
  orderNumber: string,
  reason: string,
): Promise<OrderActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new ReasonRequiredError();
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        payment: { select: { id: true } },
      },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (!legalNextActions(order).includes("REJECT_PAYMENT") || !order.payment) {
      throw new InvalidStateError();
    }

    await tx.payment.update({
      where: { id: order.payment.id },
      data: { status: "REJECTED", rejectionReason: trimmed },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "WAITING_FOR_PAYMENT" },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "WAITING_FOR_PAYMENT_VERIFICATION",
        toStatus: "WAITING_FOR_PAYMENT",
        changedById: adminId,
        note: `Payment rejected: ${trimmed}`,
      },
    });

    return { orderNumber, status: "WAITING_FOR_PAYMENT" };
  });
}

/**
 * Confirm a COD order after the phone call (GATE). From
 * WAITING_FOR_ORDER_CONFIRMATION → ORDER_CONFIRMED and CREATES the Manufacturing
 * row (WAITING_FOR_PRODUCTION) — the second production gate. Payment stays
 * PENDING (COD is collected on delivery).
 */
export async function confirmCodOrder(
  adminId: string,
  orderNumber: string,
): Promise<OrderActionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        manufacturing: { select: { id: true } },
      },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (!legalNextActions(order).includes("CONFIRM_COD")) {
      throw new InvalidStateError();
    }

    if (order.manufacturing) {
      throw new Error(
        `Invariant violation: order ${orderNumber} already has a Manufacturing row at COD confirmation`,
      );
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "ORDER_CONFIRMED" },
    });

    // GATE: production work now exists.
    await tx.manufacturing.create({ data: { orderId: order.id } });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "WAITING_FOR_ORDER_CONFIRMATION",
        toStatus: "ORDER_CONFIRMED",
        changedById: adminId,
        note: "COD order confirmed by phone",
      },
    });

    return { orderNumber, status: "ORDER_CONFIRMED" };
  });
}

/** History note for each guided-advance target. */
const ADVANCE_NOTES: Record<OrderStatus, string> = {
  IN_PRODUCTION: "Production started",
  SHIPPED: "Marked shipped",
  DELIVERED: "Marked delivered",
  // The remaining statuses are never ADVANCE_MAP targets; present only so the
  // record is total. They're unreachable through advanceStatus.
  WAITING_FOR_PAYMENT: "",
  WAITING_FOR_PAYMENT_VERIFICATION: "",
  PAYMENT_VERIFIED: "",
  WAITING_FOR_ORDER_CONFIRMATION: "",
  ORDER_CONFIRMED: "",
  RETURNED: "",
  CANCELLED: "",
};

/**
 * Guided status advancement. The only legal steps are ADVANCE_MAP:
 * PAYMENT_VERIFIED/ORDER_CONFIRMED → IN_PRODUCTION, IN_PRODUCTION → SHIPPED,
 * SHIPPED → DELIVERED. Any other (from, to) pair is rejected. Does NOT touch
 * Manufacturing — the row already exists from the gate; internal stages are E.3.
 *
 * COD DELIVERY COMPLETION (Phase F): when the SHIPPED → DELIVERED step runs on a
 * COD order whose Payment is still PENDING, the payment is flipped to VERIFIED
 * (cash collected on delivery) in the SAME transaction. That single flip is what
 * makes a COD order count as recognized revenue exactly at delivery — via the
 * REVENUE_ORDER_WHERE predicate, no separate revenue write. Prepaid is already
 * VERIFIED (it passed the verification gate) so its payment is left untouched.
 */
export async function advanceStatus(
  adminId: string,
  orderNumber: string,
  toStatus: OrderStatus,
): Promise<OrderActionResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        payment: { select: { id: true, status: true } },
      },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Validate BOTH the from-state (has a legal advance) and that the requested
    // target is exactly that legal next step.
    if (ADVANCE_MAP[order.status] !== toStatus) {
      throw new InvalidTransitionError();
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: toStatus },
    });

    // COD cash-on-delivery: record payment as received when the order is
    // delivered. Prepaid payments are already VERIFIED, so the PENDING check
    // leaves them alone.
    const codPaymentRecorded =
      toStatus === "DELIVERED" &&
      order.paymentMethod === "COD" &&
      order.payment?.status === "PENDING";

    if (codPaymentRecorded) {
      await tx.payment.update({
        where: { id: order.payment!.id },
        data: { status: "VERIFIED", verifiedById: adminId, verifiedAt: new Date() },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        changedById: adminId,
        note: codPaymentRecorded
          ? "Marked delivered; COD payment recorded on delivery"
          : ADVANCE_NOTES[toStatus],
      },
    });

    return { orderNumber, status: toStatus };
  });
}

/**
 * Cancel an order (terminal). Allowed from any non-terminal, pre-SHIPPED state
 * (CANCELLABLE_STATUSES); blocked from SHIPPED / DELIVERED / CANCELLED. Stores
 * cancelledAt + cancelReason. Leaves Payment and Manufacturing as-is — no
 * auto-refund, no delete (both are manual, ADR-016 amendment / prompt decision).
 */
export async function cancelOrder(
  adminId: string,
  orderNumber: string,
  reason: string,
): Promise<OrderActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new ReasonRequiredError();
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      throw new InvalidStateError("This order can no longer be cancelled");
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: trimmed,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        changedById: adminId,
        note: `Cancelled: ${trimmed}`,
      },
    });

    return { orderNumber, status: "CANCELLED" };
  });
}

/**
 * Mark an order RETURNED (Phase F). Allowed from SHIPPED (refused on delivery)
 * or DELIVERED (post-delivery return) — enforced via the shared legalNextActions
 * rule; any other state throws InvalidStateError. Stores returnedAt +
 * returnReason.
 *
 * Revenue reversal is AUTOMATIC: RETURNED is excluded by REVENUE_ORDER_WHERE, so
 * the order drops out of recognized revenue with no manual adjustment. This works
 * identically for prepaid (counted since verification) and COD (counted since
 * delivery). Payment is LEFT as-is (a VERIFIED payment stays VERIFIED — no refund
 * status in v1) and Manufacturing is untouched (the unit was built; no inventory
 * restore in build-to-order v1).
 */
export async function markReturned(
  adminId: string,
  orderNumber: string,
  reason: string,
): Promise<OrderActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new ReasonRequiredError();
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true, paymentMethod: true },
    });
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (!legalNextActions(order).includes("MARK_RETURNED")) {
      throw new InvalidStateError("This order can no longer be returned");
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "RETURNED",
        returnedAt: new Date(),
        returnReason: trimmed,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "RETURNED",
        changedById: adminId,
        note: `Returned: ${trimmed}`,
      },
    });

    return { orderNumber, status: "RETURNED" };
  });
}
