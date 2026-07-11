"use client";

// Product delete controls (Phase E.4 Part B). Two actions, each behind a
// confirm dialog:
//   - Deactivate (soft delete): hides from the catalog, preserves order history.
//   - Permanently delete (hard): only when NO order references the product;
//     disabled otherwise with the reason shown.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

export function ProductDangerZone({
  productId,
  isActive,
  hasOrders,
}: {
  productId: string;
  isActive: boolean;
  hasOrders: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(hard: boolean) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/admin/products/${productId}${hard ? "?hard=true" : ""}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not delete the product.");
      }
      toast.success(hard ? "Product permanently deleted." : "Product deactivated.");
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the product.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-200 p-6">
      <h2 className="font-medium text-red-700">Danger zone</h2>
      <div className="mt-4 flex flex-col gap-4">
        {isActive && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Deactivate product</p>
              <p className="text-muted-foreground text-sm">
                Hides it from the catalog. Order history is preserved.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  Deactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate this product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will no longer appear in the customer catalog. You can
                    reactivate it later from the edit form.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => run(false)}>
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-4">
          <div>
            <p className="text-sm font-medium">Permanently delete</p>
            <p className="text-muted-foreground text-sm">
              {hasOrders
                ? "Unavailable — this product appears on existing orders. Deactivate it instead."
                : "Removes the product and its images for good. This cannot be undone."}
            </p>
          </div>
          {hasOrders ? (
            <Button variant="destructive" disabled>
              Permanently delete
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Permanently delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete this product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The product and its images will be removed for good. This
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => run(true)}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
