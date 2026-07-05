"use client";

// Unified cart context (Phase C.1). Components call useCart() and never care
// whether the visitor is a guest or signed in:
//
// - USER mode: actions hit /api/v1/cart/*; each response's CartView replaces
//   local state (server is the source of truth, live prices per ADR-015).
// - GUEST mode: actions mutate the localStorage cart ({productId, quantity}
//   only), then the view re-hydrates names/prices from the public
//   /api/v1/products/by-ids endpoint — prices are never stored client-side
//   (ADR-005). itemId is null on guest lines.
//
// SSR: localStorage doesn't exist on the server, so guest state starts empty
// and hydrates in an effect after mount. Anything derived from cart counts
// (header badge) must render client-only to avoid hydration mismatches.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import * as guestCart from "@/lib/cart/guest-cart";
import { multiplyMoney, sumMoney } from "@/lib/money";
import { CART_ITEM_MAX_QUANTITY } from "@/lib/validations/cart";
import type { CartLineItem, CartView } from "@/types/cart";
import type { ProductCard } from "@/services/product-service";

const EMPTY_VIEW: CartView = {
  items: [],
  subtotal: "0.00",
  itemCount: 0,
  distinctCount: 0,
};

type CartContextValue = CartView & {
  isLoading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (productId: string, quantity: number) => Promise<void>;
  /** target = itemId when signed in, productId for guests (line.itemId ?? line.productId). */
  updateItem: (target: string, quantity: number) => Promise<void>;
  removeItem: (target: string) => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
}

function capToast() {
  toast.info("Maximum 5 per item");
}

/** Call a /api/v1/cart* endpoint and unwrap the { cart } envelope. */
async function callCartApi(path: string, init?: RequestInit): Promise<CartView> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body: { cart?: CartView; error?: { message?: string } } | null = await res
    .json()
    .catch(() => null);
  if (!res.ok || !body?.cart) {
    throw new Error(body?.error?.message ?? "Cart request failed");
  }
  return body.cart;
}

async function fetchProductsByIds(ids: string[]): Promise<ProductCard[]> {
  const res = await fetch(`/api/v1/products/by-ids?ids=${ids.join(",")}`);
  const body: { data?: ProductCard[] } | null = await res.json().catch(() => null);
  if (!res.ok || !body?.data) {
    throw new Error("Could not load cart products");
  }
  return body.data;
}

/** Guest lines whose product is missing from the (active-only) lookup are
 * omitted — a guest cart can't display a product the public API won't show. */
function composeGuestView(
  guestItems: guestCart.GuestCartItem[],
  productsById: Map<string, ProductCard>,
): CartView {
  const items: CartLineItem[] = [];
  for (const guestItem of guestItems) {
    const product = productsById.get(guestItem.productId);
    if (!product) continue;
    items.push({
      itemId: null,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      unitPrice: product.basePrice,
      quantity: guestItem.quantity,
      lineTotal: multiplyMoney(product.basePrice, guestItem.quantity),
      isActive: true,
    });
  }
  return {
    items,
    subtotal: sumMoney(items.map((item) => item.lineTotal)),
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    distinctCount: items.length,
  };
}

export function CartProvider({
  isAuthenticated,
  initialCart,
  children,
}: {
  isAuthenticated: boolean;
  initialCart: CartView | null;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<CartView>(initialCart ?? EMPTY_VIEW);
  const [isLoading, setIsLoading] = useState(!isAuthenticated);
  const [isOpen, setIsOpen] = useState(false);

  // Product data cache for guest hydration — only ids we haven't seen yet
  // get fetched on each mutation.
  const productCacheRef = useRef(new Map<string, ProductCard>());

  const refreshGuestView = useCallback(
    async (items: guestCart.GuestCartItem[]) => {
      const missingIds = items
        .map((item) => item.productId)
        .filter((id) => !productCacheRef.current.has(id));
      if (missingIds.length > 0) {
        for (const product of await fetchProductsByIds(missingIds)) {
          productCacheRef.current.set(product.id, product);
        }
      }
      setView(composeGuestView(items, productCacheRef.current));
    },
    [],
  );

  // Sync mode on mount and whenever the server-rendered props change (login,
  // logout, router.refresh after a merge).
  useEffect(() => {
    if (isAuthenticated) {
      setView(initialCart ?? EMPTY_VIEW);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await refreshGuestView(guestCart.readGuestCart());
      } catch (error) {
        console.error("Guest cart hydration failed:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, initialCart, refreshGuestView]);

  const addItem = async (productId: string, quantity: number) => {
    try {
      const existing = view.items.find((item) => item.productId === productId);
      const wouldExceedCap =
        (existing?.quantity ?? 0) + quantity > CART_ITEM_MAX_QUANTITY;

      if (isAuthenticated) {
        setView(
          await callCartApi("/api/v1/cart/items", {
            method: "POST",
            body: JSON.stringify({ productId, quantity }),
          }),
        );
      } else {
        await refreshGuestView(guestCart.addToGuestCart(productId, quantity));
      }
      if (wouldExceedCap) capToast();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add to cart");
    }
  };

  const updateItem = async (target: string, quantity: number) => {
    try {
      if (quantity > CART_ITEM_MAX_QUANTITY) capToast();
      const clamped = Math.min(Math.max(quantity, 1), CART_ITEM_MAX_QUANTITY);

      if (isAuthenticated) {
        setView(
          await callCartApi(`/api/v1/cart/items/${target}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity: clamped }),
          }),
        );
      } else {
        await refreshGuestView(guestCart.updateGuestItem(target, clamped));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cart");
    }
  };

  const removeItem = async (target: string) => {
    try {
      if (isAuthenticated) {
        setView(
          await callCartApi(`/api/v1/cart/items/${target}`, { method: "DELETE" }),
        );
      } else {
        await refreshGuestView(guestCart.removeGuestItem(target));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cart");
    }
  };

  const clear = async () => {
    try {
      if (isAuthenticated) {
        setView(await callCartApi("/api/v1/cart", { method: "DELETE" }));
      } else {
        guestCart.clearGuestCart();
        setView(EMPTY_VIEW);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update cart");
    }
  };

  return (
    <CartContext.Provider
      value={{
        ...view,
        isLoading,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        updateItem,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
