"use client";

// Coupon delete controls (Phase E.5). Two actions:
//   - Deactivate (soft): PATCH isActive=false — stops new uses, keeps the coupon
//     and its redemption records. Available while the coupon is active.
//   - Permanently delete (hard): DELETE — only when the coupon has NO redemption
//     (a redemption is an immutable financial record); disabled otherwise.

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

export function CouponDangerZone({
  couponId,
  isActive,
  hasRedemptions,
}: {
  couponId: string;
  isActive: boolean;
  hasRedemptions: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deactivate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("Could not deactivate the coupon.");
      toast.success("Coupon deactivated.");
      router.refresh();
      setBusy(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate.");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/coupons/${couponId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not delete the coupon.");
      }
      toast.success("Coupon permanently deleted.");
      router.push("/admin/coupons");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-red-200 p-6">
      <h2 className="font-medium text-red-700">Danger zone</h2>
      <div className="mt-4 flex flex-col gap-4">
        {isActive && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Deactivate coupon</p>
              <p className="text-muted-foreground text-sm">
                Stops new uses. Redemption records are preserved.
              </p>
            </div>
            <Button variant="outline" disabled={busy} onClick={deactivate}>
              Deactivate
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-4">
          <div>
            <p className="text-sm font-medium">Permanently delete</p>
            <p className="text-muted-foreground text-sm">
              {hasRedemptions
                ? "Unavailable — this coupon has been redeemed. Deactivate it instead."
                : "Removes the coupon for good. This cannot be undone."}
            </p>
          </div>
          {hasRedemptions ? (
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
                  <AlertDialogTitle>Permanently delete this coupon?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The coupon will be removed for good. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={remove}
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
