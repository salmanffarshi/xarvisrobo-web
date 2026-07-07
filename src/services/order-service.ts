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

import { Prisma, type OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { computeDeliveryCharge } from "@/lib/delivery";
import { multiplyMoney, sumMoney } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";
import {
  placeOrderSchema,
  type PlaceOrderInput,
} from "@/lib/validations/order";
import type {
  OrderDetailView,
  ShippingAddressSnapshot,
} from "@/types/order";

const MAX_ORDER_NUMBER_ATTEMPTS = 6;

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

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const candidateOrderNumber = generateOrderNumber();
    try {
      return await db.$transaction(async (tx) => {
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
        // Charge from method + the customer's chosen zone (ADR-016), via the
        // same helper the checkout summary uses so display and stored agree.
        const deliveryCharge = computeDeliveryCharge(
          parsed.paymentMethod,
          parsed.deliveryZone,
        );
        const total = sumMoney([subtotal, deliveryCharge]);

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
          select: { orderNumber: true },
        });

        // 11. Clear the cart — atomic with the order: a failure anywhere
        // above rolls this back and the cart survives untouched.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return { orderNumber: order.orderNumber };
      });
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
      payment: { select: { status: true } },
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
    payment: { status: order.payment.status },
  };
}
