// Guest cart in localStorage (Phase C.1). Anonymous visitors have no DB cart
// (Cart.userId is @unique and login-bound), so their cart is a thin
// { productId, quantity } array in the browser. Prices and names are NEVER
// stored here — the UI hydrates them live from /api/v1/products/by-ids, so a
// tampered localStorage entry can't influence pricing (ADR-005).
//
// Every function is SSR-safe: on the server (no window) reads return empty
// and writes are no-ops, so importing this from shared client components
// never crashes a server render.

import { CART_ITEM_MAX_QUANTITY } from "@/lib/validations/cart";

export type GuestCartItem = {
  productId: string;
  quantity: number;
};

const STORAGE_KEY = "xarvisrobo.guestCart.v1";

/** Clamp to 1..cap whole units. */
function clampQuantity(quantity: number, cap: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), cap);
}

/** Parse the stored JSON defensively — localStorage is user-editable. */
function parseStored(raw: string): GuestCartItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return [];
    }
    const items: GuestCartItem[] = [];
    for (const entry of (parsed as { items: unknown[] }).items) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as GuestCartItem).productId === "string" &&
        typeof (entry as GuestCartItem).quantity === "number"
      ) {
        items.push({
          productId: (entry as GuestCartItem).productId,
          quantity: clampQuantity(
            (entry as GuestCartItem).quantity,
            CART_ITEM_MAX_QUANTITY,
          ),
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export function readGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? parseStored(raw) : [];
}

export function writeGuestCart(items: GuestCartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
}

/** Sum quantity onto any existing line for the product, clamped to cap. */
export function addToGuestCart(
  productId: string,
  quantity: number,
  cap: number = CART_ITEM_MAX_QUANTITY,
): GuestCartItem[] {
  const items = readGuestCart();
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity = clampQuantity(existing.quantity + quantity, cap);
  } else {
    items.push({ productId, quantity: clampQuantity(quantity, cap) });
  }
  writeGuestCart(items);
  return items;
}

/** Set a line's quantity (clamped 1..cap). No-op if the product isn't in the cart. */
export function updateGuestItem(
  productId: string,
  quantity: number,
  cap: number = CART_ITEM_MAX_QUANTITY,
): GuestCartItem[] {
  const items = readGuestCart();
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity = clampQuantity(quantity, cap);
    writeGuestCart(items);
  }
  return items;
}

export function removeGuestItem(productId: string): GuestCartItem[] {
  const items = readGuestCart().filter((item) => item.productId !== productId);
  writeGuestCart(items);
  return items;
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Sum of quantities — for the header badge. */
export function getGuestItemCount(): number {
  return readGuestCart().reduce((count, item) => count + item.quantity, 0);
}
