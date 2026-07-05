"use client";

// Slide-in cart drawer (Phase C.1). Pure view over useCart() — works
// identically for guest and signed-in carts. Quantity stepper allows a press
// past 5 so the provider can clamp and show the "Maximum 5 per item" toast.

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatBdt } from "@/lib/format";
import type { CartLineItem } from "@/types/cart";

function DrawerLine({ item }: { item: CartLineItem }) {
  const { updateItem, removeItem, closeCart } = useCart();
  // itemId targets the DB row when signed in; guests address lines by productId.
  const target = item.itemId ?? item.productId;

  return (
    <li className="flex gap-3 py-4">
      <Link
        href={`/products/${item.slug}`}
        onClick={closeCart}
        className="shrink-0 overflow-hidden rounded-xl"
      >
        <RobotPlaceholder slug={item.slug} name={item.name} size={64} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/products/${item.slug}`}
            onClick={closeCart}
            className="truncate text-sm font-medium text-neutral-900 hover:underline"
          >
            {item.name}
          </Link>
          <button
            type="button"
            onClick={() => void removeItem(target)}
            aria-label={`Remove ${item.name} from cart`}
            className="rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {item.isActive ? (
          <>
            <span className="mt-0.5 text-xs tabular-nums text-neutral-500">
              {formatBdt(item.unitPrice)} each
            </span>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center rounded-full border border-neutral-200">
                <button
                  type="button"
                  onClick={() => void updateItem(target, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label="Decrease quantity"
                  className="p-1.5 text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <span className="w-6 text-center text-sm tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => void updateItem(target, item.quantity + 1)}
                  aria-label="Increase quantity"
                  className="p-1.5 text-neutral-600 transition-colors hover:text-neutral-900"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <span className="text-sm font-medium tabular-nums text-neutral-900">
                {formatBdt(item.lineTotal)}
              </span>
            </div>
          </>
        ) : (
          <span className="mt-1 text-xs text-neutral-500">
            No longer available — not included in your subtotal.
          </span>
        )}
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { items, subtotal, itemCount, isOpen, closeCart } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Your cart{itemCount > 0 && ` (${itemCount})`}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-neutral-600">
              Your cart is empty. Meet the robots and pick a desk companion.
            </p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/products" onClick={closeCart}>
                Browse robots
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-neutral-100 overflow-y-auto px-4">
              {items.map((item) => (
                <DrawerLine key={item.productId} item={item} />
              ))}
            </ul>

            <div className="border-t border-neutral-100 px-4 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-neutral-600">Subtotal</span>
                <span className="font-medium tabular-nums text-neutral-900">
                  {formatBdt(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Delivery calculated at checkout.
              </p>
              <Button asChild size="lg" className="mt-4 w-full rounded-full">
                <Link href="/checkout" onClick={closeCart}>
                  Checkout
                </Link>
              </Button>
              <Link
                href="/cart"
                onClick={closeCart}
                className="mt-3 block text-center text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              >
                View cart
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
