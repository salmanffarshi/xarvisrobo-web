"use client";

// One manufacturing job card (Phase E.3). Shows the order (links to its admin
// detail), product summary, customer, the customer-facing order status (admin
// label), and time in stage. The per-card "Move to…" Select posts to the stage
// API and router.refresh()es — moving stages NEVER changes the order status
// (ADR-016). At READY_TO_SHIP a convenience link points back to the order detail
// where shipping is the explicit action (no auto-ship). A light "Add note"
// dialog appends to the job's audit trail.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_ORDER_STATUS_LABELS,
  STATUS_TONE_CLASSES,
  statusTone,
} from "@/lib/order-status";
import {
  MANUFACTURING_STAGE_ORDER,
  MANUFACTURING_STATUS_LABELS,
} from "@/lib/manufacturing-status";
import { cn } from "@/lib/utils";
import type { ManufacturingJob } from "@/types/manufacturing";

/** Compact "time in stage" from an ISO timestamp: "just now", "5m", "3h", "2d". */
function timeInStage(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function JobCard({ job }: { job: ManufacturingJob }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const base = `/api/v1/admin/manufacturing/${job.orderNumber}`;

  async function onMove(toStage: string) {
    if (toStage === job.internalStatus) return;
    setMoving(true);
    try {
      const res = await fetch(`${base}/stage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toStage }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Something went wrong.");
      }
      toast.success(
        `${job.orderNumber} → ${MANUFACTURING_STATUS_LABELS[toStage as keyof typeof MANUFACTURING_STATUS_LABELS]}`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setMoving(false);
    }
  }

  async function onSaveNote() {
    setSavingNote(true);
    try {
      const res = await fetch(`${base}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Something went wrong.");
      }
      toast.success("Note added.");
      setNoteOpen(false);
      setNoteText("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/admin/orders/${job.orderNumber}`}
          className="text-primary text-sm font-medium tabular-nums underline-offset-4 hover:underline"
        >
          {job.orderNumber}
        </Link>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            STATUS_TONE_CLASSES[statusTone(job.orderStatus)],
          )}
        >
          {ADMIN_ORDER_STATUS_LABELS[job.orderStatus]}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium">{job.productSummary}</p>
      <p className="text-muted-foreground text-xs">{job.customerName}</p>

      <p className="text-muted-foreground mt-1 text-xs">
        In stage for {timeInStage(job.updatedAt)}
      </p>

      {job.isReadyToShip && (
        <Link
          href={`/admin/orders/${job.orderNumber}`}
          className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          Ready — mark shipped on the order
          <ArrowUpRight className="size-3" strokeWidth={1.5} />
        </Link>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Select
          value={job.internalStatus}
          onValueChange={onMove}
          disabled={moving}
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            {moving ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Moving…
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {MANUFACTURING_STAGE_ORDER.map((stage) => (
              <SelectItem
                key={stage}
                value={stage}
                disabled={stage === job.internalStatus}
              >
                {MANUFACTURING_STATUS_LABELS[stage]}
                {stage === job.internalStatus && " (current)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setNoteOpen(true)}
          aria-label="Add production note"
        >
          <StickyNote className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      <Dialog
        open={noteOpen}
        onOpenChange={(open) => {
          if (!open && !savingNote) {
            setNoteOpen(false);
            setNoteText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add production note</DialogTitle>
            <DialogDescription>
              Appended to {job.orderNumber}&apos;s internal audit trail (staff-only).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="job-note" className="sr-only">
              Note
            </Label>
            <Textarea
              id="job-note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Firmware flash failed once, retried OK."
              rows={3}
              disabled={savingNote}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingNote}
              onClick={() => {
                if (!savingNote) {
                  setNoteOpen(false);
                  setNoteText("");
                }
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={savingNote || noteText.trim().length === 0}
              onClick={onSaveNote}
            >
              {savingNote && <Loader2 className="size-4 animate-spin" />}
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
