// Manufacturing board page (Phase E.3). Server component: the (dashboard) layout
// already guards staff; this re-guards (defense-in-depth), reads the board via
// the service (ADR-003 — no query logic here), and renders. Internal/staff-only:
// manufacturing stages are never exposed to customers (ADR-006 / ADR-016).

import { requireStaffPage } from "@/lib/auth-guards";
import { getBoard } from "@/services/manufacturing-service";
import { ManufacturingBoard } from "./manufacturing-board";

export default async function AdminManufacturingPage() {
  await requireStaffPage();

  const board = await getBoard();
  const activeCount = Object.values(board).reduce(
    (sum, jobs) => sum + jobs.length,
    0,
  );

  return (
    <div className="px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manufacturing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeCount} {activeCount === 1 ? "job" : "jobs"} in production
        </p>
      </header>

      {activeCount === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <p className="text-sm font-medium">No jobs in production right now.</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Jobs appear here once an order&apos;s payment is verified or a COD
            order is confirmed.
          </p>
        </div>
      ) : (
        <ManufacturingBoard board={board} />
      )}
    </div>
  );
}
