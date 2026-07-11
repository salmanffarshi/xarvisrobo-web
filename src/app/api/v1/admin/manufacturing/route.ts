// GET /api/v1/admin/manufacturing — the production board: all active jobs grouped
// by internal stage (Phase E.3). Staff-only. HTTP glue over getBoard (ADR-003).

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { getBoard } from "@/services/manufacturing-service";

export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const board = await getBoard();
  return NextResponse.json(board);
}
