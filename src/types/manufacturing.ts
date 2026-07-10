// Manufacturing board view types (Phase E.3). The shape the board service
// (getBoard) returns and the board page renders. Kept separate from the Prisma
// row: cards carry denormalised, presentation-ready fields (customer name,
// product summary from OrderItem snapshots) so the page does no querying.

import type { ManufacturingStatus, OrderStatus } from "@prisma/client";

/** One production job = one Manufacturing row for an actively-produced order. */
export interface ManufacturingJob {
  orderNumber: string;
  internalStatus: ManufacturingStatus;
  /** Customer-facing order status (admin label applied at render). */
  orderStatus: OrderStatus;
  /** "Xarvis Mini ×2, Xarvis Pro ×1" — from the OrderItem productSnapshots. */
  productSummary: string;
  customerName: string;
  createdAt: string;
  /** When production first started (first move off WAITING_FOR_PRODUCTION), or null. */
  startedAt: string | null;
  /** Last stage move (or row creation) — drives "time in stage". */
  updatedAt: string;
  /** Convenience flag: internalStatus === READY_TO_SHIP. */
  isReadyToShip: boolean;
}

/**
 * The whole board: every stage present (even empty ones), each mapping to its
 * jobs in that stage. The page renders MANUFACTURING_STAGE_ORDER columns and
 * reads jobs from here.
 */
export type ManufacturingBoard = Record<ManufacturingStatus, ManufacturingJob[]>;
