// Manufacturing board service (Phase E.3, ADR-003). Read + stage-move logic for
// the internal production board. STAFF-ONLY: routes call requireStaff first;
// these functions do no auth themselves and take the acting adminId only for the
// notes audit trail.
//
// THE CORE INVARIANT (ADR-006 / ADR-016): moving a job through internal stages
// NEVER touches the customer-facing Order.status. The two tracks are independent
// — no OrderStatusHistory row is written here (that log is for OrderStatus), and
// reaching READY_TO_SHIP does NOT auto-ship (shipping stays the explicit E.2.2
// advanceStatus action). Jobs only exist post-gate: the Manufacturing row is
// created by verifyPayment / confirmCodOrder (E.2.2) and never here.

import { db } from "@/lib/db";
import {
  MANUFACTURING_STAGE_ORDER,
  MANUFACTURING_STATUS_LABELS,
} from "@/lib/manufacturing-status";
import type {
  ManufacturingBoard,
  ManufacturingJob,
} from "@/types/manufacturing";

import type { ManufacturingStatus, OrderStatus, Prisma } from "@prisma/client";

/**
 * Orders in ACTIVE production — the only ones whose jobs appear on the board.
 * PAYMENT_VERIFIED / ORDER_CONFIRMED are freshly gated (build not yet started);
 * IN_PRODUCTION is under way. SHIPPED / DELIVERED / CANCELLED have left the board
 * (their build is done or moot).
 */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PAYMENT_VERIFIED",
  "ORDER_CONFIRMED",
  "IN_PRODUCTION",
];

/** No Manufacturing row for this order — can't work a job that hasn't passed the gate. HTTP 404. */
export class NoManufacturingError extends Error {
  readonly code = "NO_MANUFACTURING";
  constructor() {
    super("This order has no production record.");
    this.name = "NoManufacturingError";
  }
}

/** The order is no longer in active production (SHIPPED/DELIVERED/CANCELLED). HTTP 409. */
export class NotActiveError extends Error {
  readonly code = "NOT_ACTIVE";
  constructor() {
    super("This order is no longer in active production.");
    this.name = "NotActiveError";
  }
}

/** The requested target isn't a real manufacturing stage. HTTP 400. */
export class InvalidStageError extends Error {
  readonly code = "INVALID_STAGE";
  constructor() {
    super("That is not a valid manufacturing stage.");
    this.name = "InvalidStageError";
  }
}

/** "Xarvis Mini ×2, Xarvis Pro ×1" from the OrderItem productSnapshots. */
function summariseItems(
  items: { quantity: number; productSnapshot: Prisma.JsonValue }[],
): string {
  return items
    .map((item) => {
      const snapshot = item.productSnapshot as { name: string };
      return `${snapshot.name} ×${item.quantity}`;
    })
    .join(", ");
}

/** Append a timestamped audit line to an existing notes blob. */
function appendNoteLine(
  existing: string | null,
  adminName: string,
  text: string,
): string {
  const line = `[${new Date().toISOString()}] ${adminName}: ${text}`;
  return existing ? `${existing}\n${line}` : line;
}

/**
 * The board: every active-production job, grouped into all 8 stages (empty
 * stages included, so the board always renders 8 columns).
 */
export async function getBoard(): Promise<ManufacturingBoard> {
  const rows = await db.manufacturing.findMany({
    where: { order: { status: { in: ACTIVE_ORDER_STATUSES } } },
    select: {
      internalStatus: true,
      startedAt: true,
      createdAt: true,
      updatedAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          createdAt: true,
          user: { select: { name: true } },
          items: { select: { quantity: true, productSnapshot: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  // Seed every stage so empty columns still render.
  const board = Object.fromEntries(
    MANUFACTURING_STAGE_ORDER.map((stage) => [stage, [] as ManufacturingJob[]]),
  ) as ManufacturingBoard;

  for (const row of rows) {
    board[row.internalStatus].push({
      orderNumber: row.order.orderNumber,
      internalStatus: row.internalStatus,
      orderStatus: row.order.status,
      productSummary: summariseItems(row.order.items),
      customerName: row.order.user.name,
      createdAt: row.order.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      isReadyToShip: row.internalStatus === "READY_TO_SHIP",
    });
  }

  return board;
}

/**
 * Move a job to any stage (forward OR backward — QC failure can send it back to
 * Assembly; no adjacency rule). Maintains startedAt / completedAt and appends an
 * audit line to notes. Does NOT touch Order.status (ADR-016).
 */
export async function moveStage(
  adminId: string,
  orderNumber: string,
  toStage: ManufacturingStatus,
): Promise<void> {
  if (!MANUFACTURING_STAGE_ORDER.includes(toStage)) {
    throw new InvalidStageError();
  }

  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: {
        status: true,
        manufacturing: {
          select: { id: true, startedAt: true, notes: true },
        },
      },
    });
    if (!order?.manufacturing) {
      throw new NoManufacturingError();
    }
    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      throw new NotActiveError();
    }

    const admin = await tx.user.findUnique({
      where: { id: adminId },
      select: { name: true },
    });

    const { manufacturing } = order;
    await tx.manufacturing.update({
      where: { id: manufacturing.id },
      data: {
        internalStatus: toStage,
        // First real production activity stamps startedAt (once).
        startedAt:
          manufacturing.startedAt === null && toStage !== "WAITING_FOR_PRODUCTION"
            ? new Date()
            : manufacturing.startedAt,
        // completedAt tracks READY_TO_SHIP: set on arrival, cleared on any move off it.
        completedAt: toStage === "READY_TO_SHIP" ? new Date() : null,
        notes: appendNoteLine(
          manufacturing.notes,
          admin?.name ?? "Staff",
          `→ ${MANUFACTURING_STATUS_LABELS[toStage]}`,
        ),
      },
    });
  });
}

/** Append a free-text production note to the job's audit trail. */
export async function addNote(
  adminId: string,
  orderNumber: string,
  note: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber },
      select: { manufacturing: { select: { id: true, notes: true } } },
    });
    if (!order?.manufacturing) {
      throw new NoManufacturingError();
    }

    const admin = await tx.user.findUnique({
      where: { id: adminId },
      select: { name: true },
    });

    await tx.manufacturing.update({
      where: { id: order.manufacturing.id },
      data: {
        notes: appendNoteLine(order.manufacturing.notes, admin?.name ?? "Staff", note),
      },
    });
  });
}
