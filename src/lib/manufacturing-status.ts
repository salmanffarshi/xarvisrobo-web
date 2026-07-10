// Internal manufacturing-stage presentation (Phase E.3). The manufacturing
// analogue of order-status.ts: single source of truth for how each internal
// build stage reads and how the board's columns are ordered. STAFF-ONLY — these
// labels are never shown to customers (ADR-006 / ADR-016: manufacturing stages
// are internal and separate from the customer-facing OrderStatus).
//
// Pure logic, no DB import — the board cards (client components) import this
// directly for labels and the Select options.

import type { ManufacturingStatus } from "@prisma/client";

/** Human-readable label per internal stage. Verbatim staff-facing (no softening). */
export const MANUFACTURING_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  WAITING_FOR_PRODUCTION: "Waiting for Production",
  COMPONENTS_COLLECTED: "Components Collected",
  ASSEMBLY: "Assembly",
  FIRMWARE_INSTALLED: "Firmware Installed",
  TESTING: "Testing",
  QC: "Quality Check",
  PACKAGING: "Packaging",
  READY_TO_SHIP: "Ready to Ship",
};

/**
 * The 8 stages in workflow order. Drives the board columns left→right and the
 * Select options. Also the authority for "is this a real stage" on the server.
 */
export const MANUFACTURING_STAGE_ORDER: ManufacturingStatus[] = [
  "WAITING_FOR_PRODUCTION",
  "COMPONENTS_COLLECTED",
  "ASSEMBLY",
  "FIRMWARE_INSTALLED",
  "TESTING",
  "QC",
  "PACKAGING",
  "READY_TO_SHIP",
];

/**
 * Coarse stage-group tone for subtly coloring a column header / card accent,
 * kept within the site's restrained palette: the queued head (neutral), the
 * mid build stages (blue progress), and the finished-build end (green). The
 * caller maps the token to classes.
 */
export type StageTone = "queued" | "building" | "ready";

export const STAGE_TONE_CLASSES: Record<StageTone, string> = {
  queued: "bg-neutral-100 text-neutral-600",
  building: "bg-blue-50 text-blue-700",
  ready: "bg-emerald-50 text-emerald-700",
};

export function stageTone(stage: ManufacturingStatus): StageTone {
  if (stage === "WAITING_FOR_PRODUCTION") return "queued";
  if (stage === "READY_TO_SHIP") return "ready";
  return "building";
}
