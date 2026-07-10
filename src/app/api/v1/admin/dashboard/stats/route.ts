// /api/v1/admin/dashboard/stats — read-only aggregate for the admin dashboard
// home (Phase E.1). The dashboard page calls the service directly (server
// component); this route exists so future admin tooling / the ops app consume
// the same stats (versioned-API principle). Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { getDashboardStats } from "@/services/admin-service";

/** GET /api/v1/admin/dashboard/stats */
export async function GET() {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[GET /api/v1/admin/dashboard/stats] unexpected error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
