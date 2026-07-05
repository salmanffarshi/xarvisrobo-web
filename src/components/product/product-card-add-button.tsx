"use client";

// Small add-to-cart button for product cards (Phase C.1). The whole card is a
// <Link>, so this click must not navigate — preventDefault/stopPropagation
// keep the add local, then the drawer opens for feedback.

import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";

export function ProductCardAddButton({ productId }: { productId: string }) {
  const { addItem, openCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    const added = await addItem(productId, 1);
    setIsAdding(false);
    if (added) {
      toast.success("Added to cart");
      openCart();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isAdding}
      onClick={(e) => void handleClick(e)}
      className="w-full rounded-full"
    >
      {isAdding ? "Adding…" : "Add to cart"}
    </Button>
  );
}
