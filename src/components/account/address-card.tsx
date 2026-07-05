"use client";

// One saved-address card (Phase B.3): edit (dialog), delete (confirm dialog —
// deletion is irreversible, so it must not happen on a stray tap), and
// set-as-default. Client component for the dialog/open state and the actions.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AddressForm,
  type AddressData,
} from "@/components/account/address-form";

export function AddressCard({ address }: { address: AddressData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  async function handleDelete() {
    setIsWorking(true);
    try {
      const res = await fetch(`/api/v1/me/addresses/${address.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      toast.success("Address deleted.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSetDefault() {
    setIsWorking(true);
    try {
      const res = await fetch(`/api/v1/me/addresses/${address.id}/default`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      toast.success("Default address updated.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">{address.label}</h3>
        {address.isDefault && (
          <Badge className="bg-blue-50 text-blue-600" variant="secondary">
            Default
          </Badge>
        )}
      </div>

      <div className="mt-3 flex-1 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">{address.recipientName}</p>
        <p className="mt-0.5">{address.phone}</p>
        <p className="mt-2">
          {address.streetAddress}, {address.city}, {address.district}{" "}
          {address.postalCode}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>Edit address</DialogTitle>
              <DialogDescription>
                Changes apply to future orders only.
              </DialogDescription>
            </DialogHeader>
            <AddressForm
              address={address}
              onSuccess={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-red-600 hover:text-red-600"
              disabled={isWorking}
            >
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this address?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{address.label}&rdquo; will be removed permanently. This
                can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="rounded-full bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!address.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-blue-600 hover:text-blue-600"
            onClick={handleSetDefault}
            disabled={isWorking}
          >
            {isWorking && <Loader2 className="size-4 animate-spin" />}
            Set as default
          </Button>
        )}
      </div>
    </div>
  );
}
