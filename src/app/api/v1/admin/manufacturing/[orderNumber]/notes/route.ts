// POST /api/v1/admin/manufacturing/:orderNumber/notes — append a production note
// to a job's audit trail (Phase E.3). Body: { note }. Staff-only. The service
// requires the Manufacturing row to exist (→ 404). An empty note is treated as a
// no-op bad request at this boundary.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { manufacturingErrorResponse } from "@/lib/manufacturing-action-errors";
import { addNote } from "@/services/manufacturing-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { orderNumber } = await params;
  const body = await req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note) {
    return NextResponse.json(
      { error: { code: "NOTE_REQUIRED", message: "A note is required." } },
      { status: 400 },
    );
  }

  try {
    await addNote(guard.session.user.id, orderNumber, note);
    return NextResponse.json({ orderNumber });
  } catch (error) {
    return manufacturingErrorResponse(
      error,
      `POST /api/v1/admin/manufacturing/${orderNumber}/notes`,
    );
  }
}
