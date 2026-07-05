"use client";

// "Add address" CTA + dialog (Phase B.3). Client component because the dialog
// open state lives here; the form closes it via onSuccess.

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddressForm } from "@/components/account/address-form";

export function AddAddressDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" />
          Add address
        </Button>
      </DialogTrigger>
      {/* Scrolls internally so all fields stay reachable on small screens. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add address</DialogTitle>
          <DialogDescription>
            Saved addresses speed up checkout. Delivery is within Bangladesh.
          </DialogDescription>
        </DialogHeader>
        <AddressForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
