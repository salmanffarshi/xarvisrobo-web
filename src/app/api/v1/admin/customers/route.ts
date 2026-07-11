// GET /api/v1/admin/customers — list/search CUSTOMER-role users. Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { list } from "@/services/customer-admin-service";

export async function GET(req: Request) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1;

  const result = await list({ search, page });
  return NextResponse.json(result);
}
