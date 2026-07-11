"use client";

// The manufacturing board (Phase E.3). Two responsive shapes from the same data:
//   - Desktop (lg+): a horizontally-scrollable kanban — 8 stage columns in
//     workflow order, each with its label + count, cards beneath. Empty columns
//     still render as visible (empty) drop zones. No drag-and-drop — moves happen
//     via each card's "Move to…" Select.
//   - Mobile: a single-column list with a stage filter Select at the top.
// Restrained palette: neutral column headers, white cards, blue only on links.

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MANUFACTURING_STAGE_ORDER,
  MANUFACTURING_STATUS_LABELS,
} from "@/lib/manufacturing-status";
import type { ManufacturingStatus } from "@prisma/client";
import type { ManufacturingBoard } from "@/types/manufacturing";
import { JobCard } from "./job-card";

const ALL = "ALL" as const;

export function ManufacturingBoard({ board }: { board: ManufacturingBoard }) {
  // Mobile stage filter — "ALL" shows every stage with subheaders.
  const [filter, setFilter] = useState<ManufacturingStatus | typeof ALL>(ALL);

  const visibleStages =
    filter === ALL ? MANUFACTURING_STAGE_ORDER : [filter];

  return (
    <>
      {/* DESKTOP: horizontal kanban */}
      <div className="mt-6 hidden overflow-x-auto pb-4 lg:block">
        <div className="flex gap-4">
          {MANUFACTURING_STAGE_ORDER.map((stage) => {
            const jobs = board[stage];
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                  <h2 className="text-sm font-medium">
                    {MANUFACTURING_STATUS_LABELS[stage]}
                  </h2>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {jobs.length}
                  </span>
                </div>
                <div className="mt-3 flex min-h-24 flex-col gap-3 rounded-lg border border-dashed border-neutral-200 p-2">
                  {jobs.length === 0 ? (
                    <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                      Empty
                    </p>
                  ) : (
                    jobs.map((job) => (
                      <JobCard key={job.orderNumber} job={job} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE: stage filter + list */}
      <div className="mt-6 lg:hidden">
        <Select
          value={filter}
          onValueChange={(value) =>
            setFilter(value as ManufacturingStatus | typeof ALL)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {MANUFACTURING_STAGE_ORDER.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {MANUFACTURING_STATUS_LABELS[stage]} ({board[stage].length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mt-4 space-y-6">
          {visibleStages.map((stage) => {
            const jobs = board[stage];
            if (jobs.length === 0) return null;
            return (
              <div key={stage}>
                <h2 className="text-muted-foreground mb-2 text-xs font-medium">
                  {MANUFACTURING_STATUS_LABELS[stage]} ({jobs.length})
                </h2>
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <JobCard key={job.orderNumber} job={job} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
