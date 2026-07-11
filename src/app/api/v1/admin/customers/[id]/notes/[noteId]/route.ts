// DELETE /api/v1/admin/customers/:id/notes/:noteId — delete an internal note
// (author or any ADMIN). Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { customerErrorResponse } from "@/lib/customer-admin-errors";
import { deleteNote } from "@/services/customer-admin-service";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id, noteId } = await params;
  try {
    await deleteNote(guard.session.user.id, id, noteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return customerErrorResponse(error);
  }
}
