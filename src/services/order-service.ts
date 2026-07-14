// Order placement + customer order reads (Phase C.2, ADR-003).
//
// PRICING (ADR-005): every monetary value is recomputed here from the live
// Product.basePrice at placement time. Nothing client-sent is trusted — the
// input carries no prices at all. Math via src/lib/money (decimal strings,
// never JS floats); Prisma accepts the strings directly into Decimal columns.
//
// SNAPSHOTS (ADR-004): the shipping address and each product are copied into
// JSON at placement so historical orders never change when the user edits an
// address or an admin edits a product.
//
// IDEMPOTENCY: Order.idempotencyKey is unique. A repeat submit with the same
// key returns the existing orderNumber instead of creating a second order —
// checked up front for the common case, and via the unique constraint for the
// concurrent case (two identical submits racing).
//
// RETRY SHAPE: the retry loop wraps the WHOLE transaction. Postgres aborts a
// transaction on its first failed statement, so an orderNumber collision
// cannot be retried inside the transaction — the attempt rolls back fully and
// we rerun it with a fresh candidate (max 6; collisions are ~1 in 28.6M per
// day-bucket, so more than one retry means something is pathologically wrong).
//
// Pre-order model: no stock checks, no stock decrement.

import {
  Prisma,
  type DiscountType,
  type OrderStatus,
  type PaymentMethod,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  COUPON_REASON_MESSAGES,
  normalizeCode,
  validateCoupon,
  type CouponFailureReason,
} from "@/lib/coupon";
import { computeDeliveryCharge } from "@/lib/delivery";
import { multiplyMoney, subtractMoney, sumMoney } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";
import {
  notifyAdminNewOrder,
  notifyOrderPlaced,
} from "@/services/notification-service";
import { getSettings } from "@/services/settings-service";
import {
  placeOrderSchema,
  type PlaceOrderInput,
} from "@/lib/validations/order";
import type {
  AdminOrderDetail,
  AdminOrderListResult,
  AdminOrderSummary,
} from "@/types/admin";
import type {
  OrderDetailView,
  OrderListResult,
  OrderSummary,
  ShippingAddressSnapshot,
} from "@/types/order";

const MAX_ORDER_NUMBER_ATTEMPTS = 6;

/** Per-page cap for the order-history list (ADR/API convention). */
const ORDER_LIST_MAX_LIMIT = 50;

/** Thrown when placing an order with an empty cart. Mapped to HTTP 400. */
export class EmptyCartError extends Error {
  readonly code = "EMPTY_CART";
  constructor() {
    super("Your cart is empty");
    this.name = "EmptyCartError";
  }
}

/** Thrown when a cart line's product was deleted or deactivated between
 * adding and checkout. Never silently dropped — the customer must remove it.
 * Mapped to HTTP 409 with the product name in details. */
export class ProductUnavailableError extends Error {
  readonly code = "PRODUCT_UNAVAILABLE";
  constructor(readonly productName: string) {
    super(`"${productName}" is no longer available. Remove it from your cart to continue.`);
    this.name = "ProductUnavailableError";
  }
}

/** Thrown when addressId doesn't exist OR belongs to another user (the two
 * cases are deliberately indistinguishable). Mapped to HTTP 400. */
export class AddressNotFoundError extends Error {
  readonly code = "ADDRESS_NOT_FOUND";
  constructor() {
    super("Shipping address not found");
    this.name = "AddressNotFoundError";
  }
}

/** Thrown when a coupon can't be redeemed at placement — not found, inactive,
 * expired, below the minimum, or a usage cap already reached (possibly hit by a
 * concurrent order between checkout and placement). The whole placement is
 * rejected (the coupon is never silently dropped). Mapped to HTTP 409. */
export class CouponInvalidError extends Error {
  readonly code = "COUPON_INVALID";
  constructor(readonly reason: CouponFailureReason, message: string) {
    super(message);
    this.name = "CouponInvalidError";
  }
}

/** The coupon columns we lock + read for redemption (SELECT … FOR UPDATE). */
type CouponLockRow = {
  id: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
};

function isUniqueViolationOn(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}

/**
 * Place an order from the user's cart. Returns the new order's number — or,
 * when the idempotency key has been seen before, the existing order's number.
 */
export async function placeOrder(
  userId: string,
  input: PlaceOrderInput,
  idempotencyKey: string,
): Promise<{ orderNumber: string }> {
  const parsed = placeOrderSchema.parse(input);

  // Fast path: this exact submit already succeeded (double-click, retry after
  // a dropped response). Return the order it created instead of a duplicate.
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
    select: { orderNumber: true, userId: true },
  });
  if (existing && existing.userId === userId) {
    return { orderNumber: existing.orderNumber };
  }

  // COD charge numbers come from the admin-editable Settings row (Phase E.4);
  // the charge is still computed server-side (ADR-005) — only the two NUMBERS
  // moved out of config. Read once, outside the retry loop.
  const settings = await getSettings();
  const codCharges = {
    insideDhaka: settings.codInsideDhaka,
    outsideDhaka: settings.codOutsideDhaka,
  };

  // Normalized once (UPPERCASE) — null means no coupon was applied.
  const normalizedCouponCode = parsed.couponCode
    ? normalizeCode(parsed.couponCode)
    : null;

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const candidateOrderNumber = generateOrderNumber();
    try {
      const result = await db.$transaction(async (tx) => {
        // 1. Cart with live products (ADR-015: live price is authoritative
        //    until this very moment, where it freezes into the order).
        const cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    slug: true,
                    specifications: true,
                    basePrice: true,
                    isActive: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });
        if (!cart || cart.items.length === 0) {
          throw new EmptyCartError();
        }

        // 2. Every line must still be purchasable.
        for (const item of cart.items) {
          if (!item.product.isActive) {
            throw new ProductUnavailableError(item.product.name);
          }
        }

        // 3. Address ownership — someone else's addressId is a miss.
        const address = await tx.address.findFirst({
          where: { id: parsed.addressId, userId },
        });
        if (!address) {
          throw new AddressNotFoundError();
        }

        // 4. Server-side totals (ADR-005), decimal strings throughout.
        const lines = cart.items.map((item) => {
          const unitPrice = item.product.basePrice.toFixed(2);
          return {
            product: item.product,
            quantity: item.quantity,
            unitPrice,
            lineTotal: multiplyMoney(unitPrice, item.quantity),
          };
        });
        const subtotal = sumMoney(lines.map((line) => line.lineTotal));

        // 4b. Coupon redemption (Phase E.5), race-safe. Lock the Coupon row
        //     FOR UPDATE so concurrent placements of the same coupon serialize:
        //     the second waits here, then counts redemptions AFTER the first
        //     commits and is correctly rejected if a cap is now reached. The
        //     discount is recomputed server-side from the SAME pure module the
        //     checkout preview uses (ADR-005). Applies to the SUBTOTAL only.
        let discountAmount = "0.00";
        let appliedCouponId: string | null = null;
        if (normalizedCouponCode) {
          const rows = await tx.$queryRaw<CouponLockRow[]>`
            SELECT "id", "discountType", "discountValue", "minOrderAmount",
                   "totalUsageLimit", "perCustomerLimit", "validFrom",
                   "validUntil", "isActive"
            FROM "Coupon"
            WHERE "code" = ${normalizedCouponCode}
            FOR UPDATE
          `;
          const coupon = rows[0];
          if (!coupon) {
            throw new CouponInvalidError(
              "NOT_FOUND",
              COUPON_REASON_MESSAGES.NOT_FOUND,
            );
          }
          // Counts under the lock — see the serialization note above.
          const [totalRedemptionCount, userRedemptionCount] = await Promise.all([
            tx.couponRedemption.count({ where: { couponId: coupon.id } }),
            tx.couponRedemption.count({ where: { couponId: coupon.id, userId } }),
          ]);
          const result = validateCoupon({
            coupon,
            subtotal,
            userRedemptionCount,
            totalRedemptionCount,
            now: new Date(),
          });
          if (!result.ok) {
            throw new CouponInvalidError(result.reason, result.message);
          }
          discountAmount = result.discount;
          appliedCouponId = coupon.id;
        }

        // Charge from method + the customer's chosen zone (ADR-016), via the
        // same helper the checkout summary uses so display and stored agree.
        // Delivery is NEVER discounted (ADR-017) — the coupon touches subtotal
        // only. total = subtotal − discount + delivery, always ≥ delivery ≥ 0
        // (discount is capped at the subtotal).
        const deliveryCharge = computeDeliveryCharge(
          parsed.paymentMethod,
          parsed.deliveryZone,
          codCharges,
        );
        const total = sumMoney([
          subtractMoney(subtotal, discountAmount),
          deliveryCharge,
        ]);

        // 5. Method-specific initial status (ADR-016): COD waits for a phone
        //    confirmation; prepaid waits for payment. Neither enters production
        //    here — that's a Phase E gate.
        const initialStatus: OrderStatus =
          parsed.paymentMethod === "COD"
            ? "WAITING_FOR_ORDER_CONFIRMATION"
            : "WAITING_FOR_PAYMENT";

        const shippingAddress: ShippingAddressSnapshot = {
          label: address.label,
          recipientName: address.recipientName,
          phone: address.phone,
          streetAddress: address.streetAddress,
          city: address.city,
          district: address.district,
          postalCode: address.postalCode,
        };

        // 6.–9. Order + items + payment + history in one nested create. NO
        // Manufacturing row here (ADR-016) — it's created only at the Phase E
        // production gate (payment verified / COD confirmed). Payment starts
        // PENDING for every order (records the intent); txn fields stay null
        // until the Phase D proof upload.
        const order = await tx.order.create({
          data: {
            orderNumber: candidateOrderNumber,
            userId,
            status: initialStatus,
            paymentMethod: parsed.paymentMethod,
            deliveryZone: parsed.deliveryZone,
            subtotal,
            deliveryCharge,
            couponCode: normalizedCouponCode,
            couponId: appliedCouponId,
            discountAmount,
            total,
            currency: "BDT",
            idempotencyKey,
            shippingAddress,
            contactPhone: parsed.contactPhone,
            deliveryNotes: parsed.deliveryNotes,
            items: {
              create: lines.map((line) => ({
                productId: line.product.id,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                productSnapshot: {
                  name: line.product.name,
                  sku: line.product.sku,
                  slug: line.product.slug,
                  specifications: line.product.specifications ?? undefined,
                },
              })),
            },
            payment: {
              create: { method: parsed.paymentMethod, status: "PENDING" },
            },
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: initialStatus,
                changedById: userId,
                note: "Order placed",
              },
            },
          },
          select: { id: true, orderNumber: true },
        });

        // 10. Record the coupon redemption (Phase E.5), inside the same txn and
        // still under the coupon-row lock. orderId is @unique → at most one
        // redemption per order; a rolled-back attempt (orderNumber retry, or an
        // idempotency race) takes this row with it, so no coupon is over-used.
        if (appliedCouponId) {
          await tx.couponRedemption.create({
            data: {
              couponId: appliedCouponId,
              userId,
              orderId: order.id,
              discountAmount,
            },
          });
        }

        // 11. Clear the cart — atomic with the order: a failure anywhere
        // above rolls this back and the cart survives untouched.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return { orderNumber: order.orderNumber };
      });

      // AFTER COMMIT — this attempt is a genuinely NEW placement (the idempotent
      // replay paths return earlier, above and in the catch below, and never
      // reach here). Best-effort, non-blocking: a failed send is logged inside
      // the notify functions, never thrown, and never rolls the order back.
      void notifyOrderPlaced(result.orderNumber);
      void notifyAdminNewOrder(result.orderNumber);
      return result;
    } catch (error) {
      if (isUniqueViolationOn(error, "idempotencyKey")) {
        // Concurrency-safe path: an identical submit won the race between our
        // fast-path check and this insert. Return the order it created.
        const winner = await db.order.findFirst({
          where: { idempotencyKey, userId },
          select: { orderNumber: true },
        });
        if (winner) {
          return { orderNumber: winner.orderNumber };
        }
        throw error; // key held by another user's order — never return it
      }
      if (isUniqueViolationOn(error, "orderNumber")) {
        continue; // collision on the candidate — regenerate and retry
      }
      throw error;
    }
  }

  throw new Error(
    `Could not generate a unique order number after ${MAX_ORDER_NUMBER_ATTEMPTS} attempts`,
  );
}

/**
 * List a customer's orders, newest first, paginated (Phase D.1). Scoped to
 * `userId` — a customer only ever sees their own orders. Each summary carries
 * just what the history card needs; Manufacturing internals are never
 * included (ADR-006).
 */
export async function listForCustomer(
  userId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<OrderListResult> {
  const safeLimit = Math.min(Math.max(limit, 1), ORDER_LIST_MAX_LIMIT);
  const safePage = Math.max(page, 1);

  const [total, orders] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        deliveryZone: true,
        total: true,
        items: {
          orderBy: { id: "asc" },
          select: { quantity: true, productSnapshot: true },
        },
      },
    }),
  ]);

  const data: OrderSummary[] = orders.map((order) => {
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const firstSnapshot = order.items[0]?.productSnapshot as
      | { name: string; slug: string }
      | undefined;
    return {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentMethod: order.paymentMethod,
      deliveryZone: order.deliveryZone,
      total: order.total.toFixed(2),
      itemCount,
      firstItemName: firstSnapshot?.name ?? "",
      firstItemSlug: firstSnapshot?.slug ?? "",
    };
  });

  return {
    data,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

/**
 * Order detail for the confirmation/detail page — ONLY if the order belongs
 * to userId (an unowned orderNumber is indistinguishable from a nonexistent
 * one). Excludes Manufacturing internals (staff-only, ADR-006).
 */
export async function getOrderForCustomer(
  userId: string,
  orderNumber: string,
): Promise<OrderDetailView | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, userId },
    include: {
      items: { orderBy: { id: "asc" } },
      payment: {
        select: {
          status: true,
          transactionId: true,
          senderNumber: true,
          paidAmount: true,
          screenshotUrl: true,
          rejectionReason: true,
        },
      },
    },
  });
  if (!order || !order.payment) {
    return null;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    deliveryZone: order.deliveryZone,
    subtotal: order.subtotal.toFixed(2),
    couponCode: order.couponCode,
    discountAmount: order.discountAmount.toFixed(2),
    deliveryCharge: order.deliveryCharge.toFixed(2),
    total: order.total.toFixed(2),
    currency: order.currency,
    shippingAddress: order.shippingAddress as ShippingAddressSnapshot,
    contactPhone: order.contactPhone,
    deliveryNotes: order.deliveryNotes,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => {
      const snapshot = item.productSnapshot as { name: string; sku: string };
      return {
        name: snapshot.name,
        sku: snapshot.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      };
    }),
    payment: {
      status: order.payment.status,
      transactionId: order.payment.transactionId,
      senderNumber: order.payment.senderNumber,
      paidAmount: order.payment.paidAmount?.toFixed(2) ?? null,
      screenshotUrl: order.payment.screenshotUrl,
      rejectionReason: order.payment.rejectionReason,
    },
  };
}

// ============================================================================
// ADMIN READS (Phase E.2.1) — staff-scoped, NOT limited to one user's orders.
// The caller is already staff-guarded at the route (requireStaff); these
// functions do no auth themselves. Read-only: no mutation, no Manufacturing
// creation — that's E.2.2.
// ============================================================================

/** Filters for the admin order list. All optional except paging. */
export interface AdminOrderFilters {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  /** Case-insensitive match on orderNumber OR customer name/email. */
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * List orders across ALL customers for the admin order table, newest first,
 * paginated. Unlike `listForCustomer` this is not scoped to a user and it
 * surfaces the raw Payment status + whether a proof screenshot was submitted.
 */
export async function adminListOrders(
  filters: AdminOrderFilters = {},
): Promise<AdminOrderListResult> {
  const safeLimit = Math.min(Math.max(filters.limit ?? 20, 1), ORDER_LIST_MAX_LIMIT);
  const safePage = Math.max(filters.page ?? 1, 1);

  const search = filters.search?.trim();
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        deliveryZone: true,
        total: true,
        user: { select: { name: true, email: true } },
        items: { select: { quantity: true } },
        payment: { select: { status: true, screenshotUrl: true } },
      },
    }),
  ]);

  const data: AdminOrderSummary[] = orders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentMethod: order.paymentMethod,
    deliveryZone: order.deliveryZone,
    total: order.total.toFixed(2),
    customerName: order.user.name,
    customerEmail: order.user.email,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    // Every order has a Payment row (created at placement, ADR-016); default
    // defensively so the type stays clean without a non-null assertion.
    paymentStatus: order.payment?.status ?? "PENDING",
    hasScreenshot: Boolean(order.payment?.screenshotUrl),
  }));

  return {
    data,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

/**
 * Full staff detail for one order by orderNumber — no owner scoping (staff see
 * any order). Includes the Payment internals, the Manufacturing stage if a row
 * exists, and the complete status-history audit trail (oldest→newest). Returns
 * null when the order doesn't exist.
 */
export async function adminGetOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { orderBy: { id: "asc" } },
      payment: true,
      manufacturing: { select: { internalStatus: true } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!order) {
    return null;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    deliveryZone: order.deliveryZone,
    subtotal: order.subtotal.toFixed(2),
    couponCode: order.couponCode,
    discountAmount: order.discountAmount.toFixed(2),
    deliveryCharge: order.deliveryCharge.toFixed(2),
    total: order.total.toFixed(2),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    customerName: order.user.name,
    customerEmail: order.user.email,
    contactPhone: order.contactPhone,
    deliveryNotes: order.deliveryNotes,
    shippingAddress: order.shippingAddress as ShippingAddressSnapshot,
    items: order.items.map((item) => {
      const snapshot = item.productSnapshot as { name: string; sku: string };
      return {
        name: snapshot.name,
        sku: snapshot.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
      };
    }),
    payment: order.payment
      ? {
          method: order.payment.method,
          status: order.payment.status,
          transactionId: order.payment.transactionId,
          senderNumber: order.payment.senderNumber,
          screenshotUrl: order.payment.screenshotUrl,
          rejectionReason: order.payment.rejectionReason,
          verifiedAt: order.payment.verifiedAt?.toISOString() ?? null,
        }
      : {
          method: order.paymentMethod,
          status: "PENDING",
          transactionId: null,
          senderNumber: null,
          screenshotUrl: null,
          rejectionReason: null,
          verifiedAt: null,
        },
    manufacturingStatus: order.manufacturing?.internalStatus ?? null,
    statusHistory: order.statusHistory.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      // The order's own customer appears as "Customer" (e.g. proof submission);
      // any staff actor shows their name.
      changedBy:
        entry.changedBy.id === order.user.id ? "Customer" : entry.changedBy.name,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
