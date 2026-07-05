// Cart business logic (Phase C.1, ADR-003: services own the rules).
//
// SECURITY: every item mutation verifies the CartItem belongs to the caller's
// cart by querying with BOTH the item id AND the userId (same discipline as
// address-service). An item that exists but belongs to someone else is
// indistinguishable from one that doesn't exist (NOT_FOUND).
//
// PRICING (ADR-015): line totals and subtotal are always computed from the
// LIVE Product.basePrice at read time. CartItem.priceSnapshot records the
// add-time price but is never used for cart math. Authoritative order pricing
// happens at order placement in Phase C.2 (ADR-005).
//
// Pre-order model: stock is never checked or decremented here — the robots
// are build-to-order, so any stock level is addable.

import type { Cart, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { multiplyMoney, sumMoney } from "@/lib/money";
import {
  CART_ITEM_MAX_QUANTITY,
  addToCartSchema,
  updateCartItemSchema,
  type AddToCartInput,
  type MergeCartInput,
  type UpdateCartItemInput,
} from "@/lib/validations/cart";
import type { CartLineItem, CartView } from "@/types/cart";

/** Thrown when the item doesn't exist OR isn't owned by this user (the two
 * cases are deliberately indistinguishable). Mapped to HTTP 404 by the route. */
export class CartItemNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor() {
    super("Cart item not found");
    this.name = "CartItemNotFoundError";
  }
}

/** Thrown when adding a product that doesn't exist or is inactive.
 * Mapped to HTTP 409 by the route. */
export class ProductUnavailableError extends Error {
  readonly code = "PRODUCT_UNAVAILABLE";
  constructor() {
    super("This product is no longer available");
    this.name = "ProductUnavailableError";
  }
}

const EMPTY_CART_VIEW: CartView = {
  items: [],
  subtotal: "0.00",
  itemCount: 0,
  distinctCount: 0,
};

/** Product fields the cart needs — live price and active flag included. */
const itemProductSelect = {
  slug: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

type ItemRow = Prisma.CartItemGetPayload<{
  include: { product: { select: typeof itemProductSelect } };
}>;

function toCartView(rows: ItemRow[]): CartView {
  const items: CartLineItem[] = rows.map((row) => {
    const unitPrice = row.product.basePrice.toFixed(2);
    return {
      itemId: row.id,
      productId: row.productId,
      slug: row.product.slug,
      name: row.product.name,
      shortDescription: row.product.shortDescription,
      unitPrice,
      quantity: row.quantity,
      lineTotal: multiplyMoney(unitPrice, row.quantity),
      isActive: row.product.isActive,
    };
  });

  return {
    items,
    // Deactivated products stay visible in the cart but never count toward
    // the subtotal (C.2 blocks checkout on them; C.1 just flags).
    subtotal: sumMoney(
      items.filter((item) => item.isActive).map((item) => item.lineTotal),
    ),
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    distinctCount: items.length,
  };
}

/** The user's Cart row, created on first use (Cart.userId is @unique). */
async function getOrCreateCart(userId: string): Promise<Cart> {
  return db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

/** Current cart with live prices. A user with no Cart row yet gets an empty
 * view — reading never writes. Items ordered oldest-added first (stable UI). */
export async function getCart(userId: string): Promise<CartView> {
  const cart = await db.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: { select: itemProductSelect } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return cart ? toCartView(cart.items) : EMPTY_CART_VIEW;
}

/**
 * Add a product (upsert: adding a product already in the cart sums the
 * quantities, silently clamped to the 5-per-item cap). priceSnapshot records
 * the add-time price; cart math still uses live price (ADR-015).
 */
export async function addItem(
  userId: string,
  input: AddToCartInput,
): Promise<CartView> {
  const { productId, quantity } = addToCartSchema.parse(input);

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { isActive: true, basePrice: true },
  });
  if (!product || !product.isActive) {
    throw new ProductUnavailableError();
  }

  const cart = await getOrCreateCart(userId);
  const lineKey = { cartId_productId: { cartId: cart.id, productId } };
  const existing = await db.cartItem.findUnique({ where: lineKey });

  await db.cartItem.upsert({
    where: lineKey,
    create: {
      cartId: cart.id,
      productId,
      quantity,
      priceSnapshot: product.basePrice,
    },
    update: {
      quantity: Math.min(
        (existing?.quantity ?? 0) + quantity,
        CART_ITEM_MAX_QUANTITY,
      ),
    },
  });

  return getCart(userId);
}

/** Set an owned item's quantity (schema bounds it to 1..5). */
export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateCartItemInput,
): Promise<CartView> {
  const { quantity } = updateCartItemSchema.parse(input);

  const item = await db.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
  if (!item) {
    throw new CartItemNotFoundError();
  }

  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(userId);
}

/** Remove an owned item. */
export async function removeItem(
  userId: string,
  itemId: string,
): Promise<CartView> {
  const item = await db.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
  });
  if (!item) {
    throw new CartItemNotFoundError();
  }

  await db.cartItem.delete({ where: { id: item.id } });
  return getCart(userId);
}

/** Delete every item in the user's cart. */
export async function clearCart(userId: string): Promise<CartView> {
  await db.cartItem.deleteMany({ where: { cart: { userId } } });
  return EMPTY_CART_VIEW;
}

/**
 * Merge a guest (localStorage) cart into the user's DB cart on login/register.
 * Each guest line follows addItem semantics — sum with any existing line,
 * clamp to 5. Products that no longer exist or were deactivated are silently
 * skipped. Atomic: either the whole guest cart merges or none of it does.
 */
export async function mergeGuestCart(
  userId: string,
  guestItems: MergeCartInput["items"],
): Promise<CartView> {
  await db.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const products = await tx.product.findMany({
      where: {
        id: { in: guestItems.map((item) => item.productId) },
        isActive: true,
      },
      select: { id: true, basePrice: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const guestItem of guestItems) {
      const product = productById.get(guestItem.productId);
      if (!product) continue; // deleted or deactivated since added as guest

      const lineKey = {
        cartId_productId: { cartId: cart.id, productId: guestItem.productId },
      };
      const existing = await tx.cartItem.findUnique({ where: lineKey });
      const quantity = Math.min(
        (existing?.quantity ?? 0) + guestItem.quantity,
        CART_ITEM_MAX_QUANTITY,
      );

      await tx.cartItem.upsert({
        where: lineKey,
        create: {
          cartId: cart.id,
          productId: guestItem.productId,
          quantity,
          priceSnapshot: product.basePrice,
        },
        update: { quantity },
      });
    }
  });

  return getCart(userId);
}
