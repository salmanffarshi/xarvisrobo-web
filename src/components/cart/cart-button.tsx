"use client";

// Header cart button (Phase C.1). The badge count comes from client-side cart
// state (localStorage for guests), which the server can't know — so the badge
// renders only after mount to avoid a hydration mismatch.

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";

export function CartButton() {
  const { itemCount, openCart } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Open cart${mounted && itemCount > 0 ? ` (${itemCount} items)` : ""}`}
      className="relative rounded-full p-2 text-neutral-600 transition-colors duration-200 hover:text-neutral-900"
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
      {mounted && itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium leading-none text-white">
          {itemCount}
        </span>
      )}
    </button>
  );
}
