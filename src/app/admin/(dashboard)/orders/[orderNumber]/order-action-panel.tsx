"use client";

// Admin order-action panel (Phase E.2.2). Renders ONLY the legal actions for
// the order's current state — derived from `legalNextActions`, the SAME rule the
// server guards enforce, so the buttons can't offer anything the API will
// reject. Each action calls its POST route, shows a loading state, and on
// success toasts + router.refresh() so the page reflects the new status, the
// updated history, and (at the gates) the freshly-created Manufacturing row.
//
// Three interaction shapes:
//   - immediate: click runs the action (start production / ship / deliver)
//   - confirm:   an AlertDialog confirms first (verify / COD confirm — they
//                create the Manufacturing row, so we confirm the irreversible bit)
//   - reason:    a Dialog collects a required, non-empty reason (reject / cancel)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus, PaymentMethod } from "@prisma/client";

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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { legalNextActions, type OrderAction } from "@/lib/order-actions";

type Interaction = "immediate" | "confirm" | "reason";
type Variant = "default" | "outline" | "destructive";

interface ActionMeta {
  label: string;
  interaction: Interaction;
  variant: Variant;
  /** Path suffix under /api/v1/admin/orders/:orderNumber. */
  path: string;
  /** Static body for advance actions (the guided target). */
  body?: { toStatus: OrderStatus };
  successMessage: string;
  /** confirm interaction copy. */
  confirmTitle?: string;
  confirmDescription?: string;
  /** reason interaction copy. */
  reasonTitle?: string;
  reasonLabel?: string;
}

const ACTION_META: Record<OrderAction, ActionMeta> = {
  VERIFY_PAYMENT: {
    label: "Verify payment",
    interaction: "confirm",
    variant: "default",
    path: "/payment/verify",
    successMessage: "Payment verified — manufacturing started.",
    confirmTitle: "Verify payment and start manufacturing?",
    confirmDescription:
      "This confirms the payment was received and creates the production record. Make sure the transaction matches before verifying.",
  },
  REJECT_PAYMENT: {
    label: "Reject payment",
    interaction: "reason",
    variant: "outline",
    path: "/payment/reject",
    successMessage: "Payment rejected — the customer can resubmit.",
    reasonTitle: "Reject payment",
    reasonLabel: "Reason (shown to the customer so they can fix it)",
  },
  CONFIRM_COD: {
    label: "Confirm order",
    interaction: "confirm",
    variant: "default",
    path: "/confirm",
    successMessage: "COD order confirmed — manufacturing started.",
    confirmTitle: "Confirm this COD order and start manufacturing?",
    confirmDescription:
      "Only confirm after you've phoned the customer and they've agreed. This creates the production record.",
  },
  START_PRODUCTION: {
    label: "Start production",
    interaction: "immediate",
    variant: "default",
    path: "/advance",
    body: { toStatus: "IN_PRODUCTION" },
    successMessage: "Production started.",
  },
  MARK_SHIPPED: {
    label: "Mark shipped",
    interaction: "immediate",
    variant: "default",
    path: "/advance",
    body: { toStatus: "SHIPPED" },
    successMessage: "Marked as shipped.",
  },
  MARK_DELIVERED: {
    label: "Mark delivered",
    interaction: "immediate",
    variant: "default",
    path: "/advance",
    body: { toStatus: "DELIVERED" },
    successMessage: "Marked as delivered.",
  },
  MARK_RETURNED: {
    label: "Mark returned",
    interaction: "reason",
    variant: "destructive",
    path: "/return",
    successMessage: "Order marked as returned.",
    reasonTitle: "Mark order as returned",
    reasonLabel: "Reason for the return",
  },
  CANCEL: {
    label: "Cancel order",
    interaction: "reason",
    variant: "destructive",
    path: "/cancel",
    successMessage: "Order cancelled.",
    reasonTitle: "Cancel order",
    reasonLabel: "Reason for cancellation",
  },
};

export function OrderActionPanel({
  orderNumber,
  status,
  paymentMethod,
}: {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
}) {
  const router = useRouter();
  const actions = legalNextActions({ status, paymentMethod });

  // Which action is mid-request (disables everything + spins its button).
  const [running, setRunning] = useState<OrderAction | null>(null);
  // The open confirm / reason action (only one at a time).
  const [confirmAction, setConfirmAction] = useState<OrderAction | null>(null);
  const [reasonAction, setReasonAction] = useState<OrderAction | null>(null);
  const [reasonText, setReasonText] = useState("");

  const base = `/api/v1/admin/orders/${orderNumber}`;

  async function run(action: OrderAction, reason?: string) {
    const meta = ACTION_META[action];
    setRunning(action);
    try {
      const payload = meta.body ?? (reason !== undefined ? { reason } : undefined);
      const res = await fetch(base + meta.path, {
        method: "POST",
        ...(payload
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            }
          : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Something went wrong.");
      }
      toast.success(meta.successMessage);
      setConfirmAction(null);
      setReasonAction(null);
      setReasonText("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setRunning(null);
    }
  }

  function onClick(action: OrderAction) {
    const meta = ACTION_META[action];
    if (meta.interaction === "immediate") {
      void run(action);
    } else if (meta.interaction === "confirm") {
      setConfirmAction(action);
    } else {
      setReasonText("");
      setReasonAction(action);
    }
  }

  const busy = running !== null;

  if (actions.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Order actions</h2>
        <p className="text-muted-foreground mt-3 text-sm">
          No further actions — this order is in a terminal state.
        </p>
      </div>
    );
  }

  const confirmMeta = confirmAction ? ACTION_META[confirmAction] : null;
  const reasonMeta = reasonAction ? ACTION_META[reasonAction] : null;

  return (
    <div className="mt-6 rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-tight">Order actions</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => {
          const meta = ACTION_META[action];
          return (
            <Button
              key={action}
              variant={meta.variant}
              disabled={busy}
              onClick={() => onClick(action)}
            >
              {running === action && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {meta.label}
            </Button>
          );
        })}
      </div>

      {/* Confirm dialog (verify / COD confirm — create the production record). */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMeta?.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMeta?.confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // Keep the dialog open until the request resolves.
                e.preventDefault();
                if (confirmAction) void run(confirmAction);
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {confirmMeta?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reason dialog (reject / cancel — require a non-empty reason). */}
      <Dialog
        open={reasonAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setReasonAction(null);
            setReasonText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonMeta?.reasonTitle}</DialogTitle>
            <DialogDescription>{reasonMeta?.reasonLabel}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="action-reason" className="sr-only">
              {reasonMeta?.reasonLabel}
            </Label>
            <Textarea
              id="action-reason"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Type a clear reason…"
              rows={3}
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!busy) {
                  setReasonAction(null);
                  setReasonText("");
                }
              }}
            >
              Go back
            </Button>
            <Button
              variant={reasonMeta?.variant === "destructive" ? "destructive" : "default"}
              disabled={busy || reasonText.trim().length === 0}
              onClick={() => {
                if (reasonAction) void run(reasonAction, reasonText.trim());
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {reasonMeta?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
