"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function AddToCartButton() {
  return (
    <Button
      size="lg"
      className="w-full rounded-full sm:w-56"
      // Phase C.1 will replace this handler with the real cart mutation
      onClick={() =>
        toast.info(
          "Cart launches soon — we'll let you know when pre-orders open."
        )
      }
    >
      Add to cart
    </Button>
  );
}
