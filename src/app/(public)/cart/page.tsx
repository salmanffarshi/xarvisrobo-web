"use client";

// Full cart page (Phase C.1). Client component: cart state lives client-side
// (guest localStorage or provider state hydrated from the server cart), so
// the whole page reads from useCart() — same source as the drawer.

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";
import { Button } from "@/components/ui/button";
import { formatBdt } from "@/lib/format";
import type { CartLineItem } from "@/types/cart";

function CartRow({ item }: { item: CartLineItem }) {
  const { updateItem, removeItem } = useCart();
  const target = item.itemId ?? item.productId;

  return (
    <li className="flex gap-4 py-6 sm:gap-6">
      <Link
        href={`/products/${item.slug}`}
        className="shrink-0 overflow-hidden rounded-xl"
      >
        <RobotPlaceholder slug={item.slug} name={item.name} size={96} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.slug}`}
              className="font-medium tracking-tight text-neutral-900 hover:underline"
            >
              {item.name}
            </Link>
            {item.isActive ? (
              <p className="mt-0.5 text-sm tabular-nums text-neutral-500">
                {formatBdt(item.unitPrice)} each
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-neutral-500">
                No longer available — not included in your subtotal.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void removeItem(target)}
            aria-label={`Remove ${item.name} from cart`}
            className="rounded-full p-1.5 text-neutral-400 transition-colors hover:text-neutral-900"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {item.isActive && (
          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex items-center rounded-full border border-neutral-200">
              <button
                type="button"
                onClick={() => void updateItem(target, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label="Decrease quantity"
                className="p-2 text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-30"
              >
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => void updateItem(target, item.quantity + 1)}
                aria-label="Increase quantity"
                className="p-2 text-neutral-600 transition-colors hover:text-neutral-900"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <span className="font-medium tabular-nums text-neutral-900">
              {formatBdt(item.lineTotal)}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

export default function CartPage() {
  const { items, subtotal, isLoading } = useCart();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        Your cart
      </h1>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-5 text-center">
          <p className="text-neutral-600">
            {isLoading ? "Loading your cart…" : "Your cart is empty."}
          </p>
          {!isLoading && (
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/products">Browse robots</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-3">
          <ul className="divide-y divide-neutral-100 lg:col-span-2">
            {items.map((item) => (
              <CartRow key={item.productId} item={item} />
            ))}
          </ul>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50 p-6 shadow-soft lg:sticky lg:top-24">
              <h2 className="font-medium tracking-tight text-neutral-900">
                Order summary
              </h2>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm text-neutral-600">Subtotal</span>
                <span className="font-medium tabular-nums text-neutral-900">
                  {formatBdt(subtotal)}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Delivery calculated at checkout.
              </p>
              <Button asChild size="lg" className="mt-6 w-full rounded-full">
                <Link href="/checkout">Proceed to checkout</Link>
              </Button>
              <Link
                href="/products"
                className="mt-4 block text-center text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
