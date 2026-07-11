// POST /api/v1/admin/customers/:id/notes — add an internal note. Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { customerErrorResponse } from "@/lib/customer-admin-errors";
import { addNoteSchema } from "@/lib/validations/customer-admin";
import { addNote } from "@/services/customer-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the note and try again.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const note = await addNote(guard.session.user.id, id, parsed.data);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return customerErrorResponse(error);
  }
}
