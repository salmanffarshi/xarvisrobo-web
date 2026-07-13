// Order progress → stepper model (Phase D.1). Pure, no UI: maps an order's
// payment method + customer-facing status (ADR-016) to an ordered list of
// steps the tracker component renders. Two paths — prepaid has a payment
// gate, COD has a phone-confirmation gate — so the step labels differ by
// method. Manufacturing internals never appear here (ADR-006).
//
// SEMANTICS (Convention A): the node that matches the order's CURRENT status
// is the "current" (highlighted) node — it's the state the order is actually
// in. Every node before it is "complete"; every node after is "upcoming".
// DELIVERED is the one exception: the journey is finished, so all nodes are
// "complete" and there is NO current node.
//
// Each status therefore maps to a `currentIndex` = the index of the current
// node in its path (equivalently, how many leading nodes are complete before
// it). For DELIVERED we use `path length`, which leaves every node complete
// and none current.

import type { OrderStatus, PaymentMethod } from "@prisma/client";

export type StepState = "complete" | "current" | "upcoming";

export type ProgressStep = {
  label: string;
  state: StepState;
};

export type OrderProgress = {
  cancelled: boolean;
  returned: boolean;
  steps: ProgressStep[];
};

// The two ordered journeys (labels are customer-facing, verbatim from the
// D.1 spec).
const PREPAID_STEPS = [
  "Placed",
  "Payment Submitted",
  "Payment Verified",
  "Preparing", // IN_PRODUCTION — shown as "Preparing" to customers (Phase D.2)
  "Shipped",
  "Delivered",
] as const;

const COD_STEPS = [
  "Placed",
  "Order Confirmed",
  "Preparing", // IN_PRODUCTION — shown as "Preparing" to customers (Phase D.2)
  "Shipped",
  "Delivered",
] as const;

// Exhaustiveness guard: if a new OrderStatus is added without a mapping here,
// TypeScript fails the build rather than silently falling through.
function assertNever(status: never): never {
  throw new Error(`Unhandled order status: ${String(status)}`);
}

// Index of the current node on the prepaid path (Convention A). CANCELLED is
// handled before this is called, but the switch still covers it so the
// never-check stays exhaustive.
function prepaidCurrentIndex(status: OrderStatus): number {
  switch (status) {
    case "WAITING_FOR_PAYMENT":
      return 0; // current = Placed
    case "WAITING_FOR_PAYMENT_VERIFICATION":
      return 1; // current = Payment Submitted
    case "PAYMENT_VERIFIED":
      return 2; // current = Payment Verified
    case "IN_PRODUCTION":
      return 3; // current = In Production
    case "SHIPPED":
      return 4; // current = Shipped
    case "DELIVERED":
      return PREPAID_STEPS.length; // all complete, no current
    // COD-only + terminal statuses can't reach a prepaid order in practice;
    // list them so the enum is covered exhaustively.
    case "WAITING_FOR_ORDER_CONFIRMATION":
    case "ORDER_CONFIRMED":
    case "RETURNED":
    case "CANCELLED":
      return 0;
    default:
      return assertNever(status);
  }
}

function codCurrentIndex(status: OrderStatus): number {
  switch (status) {
    case "WAITING_FOR_ORDER_CONFIRMATION":
      return 0; // current = Placed
    case "ORDER_CONFIRMED":
      return 1; // current = Order Confirmed
    case "IN_PRODUCTION":
      return 2; // current = In Production
    case "SHIPPED":
      return 3; // current = Shipped
    case "DELIVERED":
      return COD_STEPS.length; // all complete, no current
    // Prepaid-only + terminal statuses can't reach a COD order in practice.
    case "WAITING_FOR_PAYMENT":
    case "WAITING_FOR_PAYMENT_VERIFICATION":
    case "PAYMENT_VERIFIED":
    case "RETURNED":
    case "CANCELLED":
      return 0;
    default:
      return assertNever(status);
  }
}

function buildSteps(
  labels: readonly string[],
  currentIndex: number,
): ProgressStep[] {
  return labels.map((label, index) => {
    let state: StepState;
    if (index < currentIndex) {
      state = "complete";
    } else if (index === currentIndex) {
      state = "current";
    } else {
      state = "upcoming";
    }
    return { label, state };
  });
}

/**
 * Build the stepper model for an order. When `cancelled` or `returned` is true
 * the UI renders a distinct muted treatment instead of the normal stepper, so
 * `steps` is left empty (we don't store the pre-terminal status to reconstruct
 * a path). RETURNED mirrors the CANCELLED off-path treatment (Phase F).
 */
export function getOrderProgress(
  paymentMethod: PaymentMethod,
  status: OrderStatus,
): OrderProgress {
  if (status === "CANCELLED") {
    return { cancelled: true, returned: false, steps: [] };
  }
  if (status === "RETURNED") {
    return { cancelled: false, returned: true, steps: [] };
  }

  const isCod = paymentMethod === "COD";
  const labels = isCod ? COD_STEPS : PREPAID_STEPS;
  const currentIndex = isCod
    ? codCurrentIndex(status)
    : prepaidCurrentIndex(status);

  return { cancelled: false, returned: false, steps: buildSteps(labels, currentIndex) };
}
