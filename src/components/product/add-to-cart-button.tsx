"use client";

// Product-detail add-to-cart (Phase C.1) — replaced the B.2 "cart launches
// soon" placeholder. Quantity selector (1..5, the per-item cap) + real cart
// add via useCart(); works for guests and signed-in customers alike.

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { CART_ITEM_MAX_QUANTITY } from "@/lib/validations/cart";

export function AddToCartButton({ productId }: { productId: string }) {
  const { addItem, openCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    setIsAdding(true);
    const added = await addItem(productId, quantity);
    setIsAdding(false);
    if (added) {
      toast.success("Added to cart");
      openCart();
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex w-fit items-center rounded-full border border-neutral-200">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="p-3 text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="w-8 text-center tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={() =>
            setQuantity((q) => Math.min(CART_ITEM_MAX_QUANTITY, q + 1))
          }
          disabled={quantity >= CART_ITEM_MAX_QUANTITY}
          aria-label="Increase quantity"
          className="p-3 text-neutral-600 transition-colors hover:text-neutral-900 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <Button
        size="lg"
        className="rounded-full sm:w-56"
        disabled={isAdding}
        onClick={() => void handleAdd()}
      >
        {isAdding ? "Adding…" : "Add to cart"}
      </Button>
    </div>
  );
}
