// Customer payment-proof submission (Phase D.2, ADR-003).
//
// A customer with a PREPAID order in WAITING_FOR_PAYMENT reports what they
// paid (txn id, sender number, amount, optional screenshot). This is the
// source of truth that advances the order to WAITING_FOR_PAYMENT_VERIFICATION
// (ADR-016) — an ADMIN still verifies it in Phase E, so Payment.status stays
// PENDING and NO Manufacturing row is created here.
//
// Everything runs in one transaction: the Payment update, the Order status
// transition, and the audit row (OrderStatusHistory) either all land or none
// do. Ownership is enforced by scoping the load to userId — an unowned or
// nonexistent orderNumber both surface as ORDER_NOT_FOUND (no info leak).

import { db } from "@/lib/db";
import { isOwnCloudinaryUrl } from "@/lib/cloudinary";
import {
  submitProofSchema,
  type SubmitProofInput,
} from "@/lib/validations/payment";

/** Order not found OR owned by someone else — deliberately the same error. 404. */
export class OrderNotFoundError extends Error {
  readonly code = "ORDER_NOT_FOUND";
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

/** Proof submitted for an order that can't accept it (COD, or not currently
 * WAITING_FOR_PAYMENT — e.g. already submitted, already verified). 409. */
export class InvalidStateError extends Error {
  readonly code = "INVALID_STATE";
  constructor() {
    super("This order is not awaiting payment proof");
    this.name = "InvalidStateError";
  }
}

/** A screenshot URL that isn't on our Cloudinary cloud/folder. 400. */
export class InvalidScreenshotError extends Error {
  readonly code = "INVALID_SCREENSHOT";
  constructor() {
    super("Invalid screenshot");
    this.name = "InvalidScreenshotError";
  }
}

const PREPAID_METHODS = ["BKASH", "NAGAD"] as const;

/**
 * Record a customer's payment proof and advance the order to
 * WAITING_FOR_PAYMENT_VERIFICATION. Does NOT verify payment (Phase E), does
 * NOT create a Manufacturing row (Phase E production gate), does NOT touch
 * stock.
 */
export async function submitPaymentProof(
  userId: string,
  orderNumber: string,
  input: SubmitProofInput,
): Promise<void> {
  const parsed = submitProofSchema.parse(input);

  // Validate a supplied screenshot URL BEFORE opening the transaction — a URL
  // that isn't on our cloud/folder is a client trying to store an arbitrary
  // link, and there's no DB work to do if it fails.
  if (parsed.screenshotUrl && !isOwnCloudinaryUrl(parsed.screenshotUrl)) {
    throw new InvalidScreenshotError();
  }

  await db.$transaction(async (tx) => {
    // 1. Ownership-scoped load. Miss (nonexistent OR another user's) → 404.
    const order = await tx.order.findFirst({
      where: { orderNumber, userId },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        payment: { select: { id: true } },
      },
    });
    if (!order || !order.payment) {
      throw new OrderNotFoundError();
    }

    // 2. State guard: only a prepaid order still waiting for payment can accept
    //    proof. Blocks COD, double-submits, and post-verification submits.
    const isPrepaid = (PREPAID_METHODS as readonly string[]).includes(
      order.paymentMethod,
    );
    if (!isPrepaid || order.status !== "WAITING_FOR_PAYMENT") {
      throw new InvalidStateError();
    }

    // 3. Record the reported details. Payment.status is set to PENDING and any
    //    prior rejectionReason is cleared — a resubmission after an admin
    //    rejection (which sent the order back to WAITING_FOR_PAYMENT with a
    //    REJECTED payment) must return the payment to PENDING for fresh review,
    //    and a first-time submit is already PENDING so this is a no-op there.
    //    Payment.paidAmount is left unpopulated as of the D.2 amendment (amount
    //    no longer collected; the column remains nullable).
    await tx.payment.update({
      where: { id: order.payment.id },
      data: {
        transactionId: parsed.transactionId,
        senderNumber: parsed.senderNumber,
        status: "PENDING",
        rejectionReason: null,
        ...(parsed.screenshotUrl
          ? { screenshotUrl: parsed.screenshotUrl }
          : {}),
      },
    });

    // 4. Advance the customer-facing status (ADR-016).
    await tx.order.update({
      where: { id: order.id },
      data: { status: "WAITING_FOR_PAYMENT_VERIFICATION" },
    });

    // 5. Audit the transition (ADR: every status change appends history).
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "WAITING_FOR_PAYMENT",
        toStatus: "WAITING_FOR_PAYMENT_VERIFICATION",
        changedById: userId,
        note: "Customer submitted payment proof",
      },
    });
  });
}
