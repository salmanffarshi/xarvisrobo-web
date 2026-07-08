// Order progress → stepper model (Phase D.1). Pure, no UI: maps an order's
// payment method + customer-facing status (ADR-016) to an ordered list of
// steps the tracker component renders. Two paths — prepaid has a payment
// gate, COD has a phone-confirmation gate — so the step labels differ by
// method. Manufacturing internals never appear here (ADR-006).

import type { OrderStatus, PaymentMethod } from "@prisma/client";

export type StepState = "complete" | "current" | "upcoming";

export type ProgressStep = {
  label: string;
  state: StepState;
};

export type OrderProgress = {
  cancelled: boolean;
  steps: ProgressStep[];
};

// The two ordered journeys (labels are customer-facing, verbatim from the
// D.1 spec). A status maps to a "completed count": that many leading steps
// are complete, the next is current, the rest upcoming. When the count
// equals the path length (DELIVERED), every step is complete and there is
// no current step.
const PREPAID_STEPS = [
  "Placed",
  "Payment Submitted",
  "Payment Verified",
  "In Production",
  "Shipped",
  "Delivered",
] as const;

const COD_STEPS = [
  "Placed",
  "Order Confirmed",
  "In Production",
  "Shipped",
  "Delivered",
] as const;

// Exhaustiveness guard: if a new OrderStatus is added without a mapping here,
// TypeScript fails the build rather than silently falling through.
function assertNever(status: never): never {
  throw new Error(`Unhandled order status: ${String(status)}`);
}

// Completed-count for the prepaid path. CANCELLED is handled before this is
// called, but the switch still covers it so the never-check stays exhaustive.
function prepaidCompletedCount(status: OrderStatus): number {
  switch (status) {
    case "WAITING_FOR_PAYMENT":
      return 1;
    case "WAITING_FOR_PAYMENT_VERIFICATION":
      return 2;
    case "PAYMENT_VERIFIED":
      return 3;
    case "IN_PRODUCTION":
      return 4;
    case "SHIPPED":
      return 5;
    case "DELIVERED":
      return 6;
    // COD-only + terminal statuses can't reach a prepaid order in practice;
    // list them so the enum is covered exhaustively.
    case "WAITING_FOR_ORDER_CONFIRMATION":
    case "ORDER_CONFIRMED":
    case "CANCELLED":
      return 0;
    default:
      return assertNever(status);
  }
}

function codCompletedCount(status: OrderStatus): number {
  switch (status) {
    case "WAITING_FOR_ORDER_CONFIRMATION":
      return 1;
    case "ORDER_CONFIRMED":
      return 2;
    case "IN_PRODUCTION":
      return 3;
    case "SHIPPED":
      return 4;
    case "DELIVERED":
      return 5;
    // Prepaid-only + terminal statuses can't reach a COD order in practice.
    case "WAITING_FOR_PAYMENT":
    case "WAITING_FOR_PAYMENT_VERIFICATION":
    case "PAYMENT_VERIFIED":
    case "CANCELLED":
      return 0;
    default:
      return assertNever(status);
  }
}

function buildSteps(
  labels: readonly string[],
  completedCount: number,
): ProgressStep[] {
  return labels.map((label, index) => {
    let state: StepState;
    if (index < completedCount) {
      state = "complete";
    } else if (index === completedCount) {
      state = "current";
    } else {
      state = "upcoming";
    }
    return { label, state };
  });
}

/**
 * Build the stepper model for an order. When `cancelled` is true the UI
 * renders a distinct treatment instead of the normal stepper, so `steps` is
 * left empty (we don't store the pre-cancel status to reconstruct a path).
 */
export function getOrderProgress(
  paymentMethod: PaymentMethod,
  status: OrderStatus,
): OrderProgress {
  if (status === "CANCELLED") {
    return { cancelled: true, steps: [] };
  }

  const isCod = paymentMethod === "COD";
  const labels = isCod ? COD_STEPS : PREPAID_STEPS;
  const completedCount = isCod
    ? codCompletedCount(status)
    : prepaidCompletedCount(status);

  return { cancelled: false, steps: buildSteps(labels, completedCount) };
}
