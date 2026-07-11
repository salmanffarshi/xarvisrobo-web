"use client";

// Internal notes panel (Phase E.4 Part C). Add a note, list notes (author +
// timestamp), delete a note. The delete control shows for the note's author or,
// when the viewer is an admin, for any note — matching the server rule. Each
// mutation calls the API then router.refresh.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerNoteRow } from "@/services/customer-admin-service";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

export function NotesPanel({
  customerId,
  notes,
  currentUserId,
  canDeleteAll,
}: {
  customerId: string;
  notes: CustomerNoteRow[];
  currentUserId: string;
  canDeleteAll: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not add the note.");
      }
      setContent("");
      toast.success("Note added.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the note.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/admin/customers/${customerId}/notes/${noteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? "Could not delete the note.");
      }
      toast.success("Note deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="text-sm font-medium text-muted-foreground">Internal notes</h2>

      <div className="mt-3 space-y-2">
        <Textarea
          rows={2}
          placeholder="Add an internal note (not visible to the customer)…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={busy || content.trim().length === 0}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">No notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => {
            const canDelete = canDeleteAll || note.authorId === currentUserId;
            return (
              <li key={note.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      disabled={busy}
                      onClick={() => remove(note.id)}
                      aria-label="Delete note"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {note.authorName} · {dateFormatter.format(new Date(note.createdAt))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
