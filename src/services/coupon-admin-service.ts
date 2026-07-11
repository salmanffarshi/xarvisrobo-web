// Admin coupon management (Phase E.5, ADR-003). Staff-guarded at the route;
// these functions own the rules: unique UPPERCASE code, and a hard-delete that
// is BLOCKED once the coupon has any redemption (must deactivate instead — a
// redemption is an immutable financial record).
//
// Redemptions carry a plain userId/orderId (no live FK back-relation, by
// design — the order snapshots its own coupon fields), so the detail view joins
// user names + order numbers manually. Only used on the admin detail page.

import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/coupon";
import {
  createCouponSchema,
  updateCouponSchema,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@/lib/validations/coupon";
import type { DiscountType } from "@prisma/client";

export type AdminCouponSummary = {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  redemptionCount: number;
};

export type AdminCouponRedemption = {
  id: string;
  customerName: string;
  orderNumber: string;
  discountAmount: string;
  createdAt: string;
};

export type AdminCouponDetail = AdminCouponSummary & {
  redemptions: AdminCouponRedemption[];
};

/** Thrown when a coupon id doesn't exist. Mapped to 404. */
export class CouponNotFoundError extends Error {
  readonly code = "COUPON_NOT_FOUND";
  constructor() {
    super("Coupon not found");
    this.name = "CouponNotFoundError";
  }
}

/** Thrown when creating/renaming to a code that already exists. Mapped to 409. */
export class CouponCodeTakenError extends Error {
  readonly code = "COUPON_CODE_TAKEN";
  constructor(readonly couponCode: string) {
    super(`The code "${couponCode}" is already in use.`);
    this.name = "CouponCodeTakenError";
  }
}

/** Thrown when hard-deleting a coupon that has been redeemed. Mapped to 409 —
 * the coupon must be deactivated instead so its redemption records survive. */
export class CouponHasRedemptionsError extends Error {
  readonly code = "COUPON_HAS_REDEMPTIONS";
  constructor(readonly redemptionCount: number) {
    super(
      `This coupon has ${redemptionCount} redemption(s) and can't be deleted. Deactivate it instead.`,
    );
    this.name = "CouponHasRedemptionsError";
  }
}

function toSummary(row: {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: { toFixed(dp: number): string };
  minOrderAmount: { toFixed(dp: number): string };
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
  _count: { redemptions: number };
}): AdminCouponSummary {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue.toFixed(2),
    minOrderAmount: row.minOrderAmount.toFixed(2),
    totalUsageLimit: row.totalUsageLimit,
    perCustomerLimit: row.perCustomerLimit,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    redemptionCount: row._count.redemptions,
  };
}

/** All coupons, newest first, each with its redemption count. */
export async function list(): Promise<AdminCouponSummary[]> {
  const rows = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return rows.map(toSummary);
}

/** One coupon with its redemptions (who, which order, how much, when). */
export async function get(id: string): Promise<AdminCouponDetail> {
  const coupon = await db.coupon.findUnique({
    where: { id },
    include: {
      _count: { select: { redemptions: true } },
      redemptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!coupon) throw new CouponNotFoundError();

  // Join user names + order numbers manually (no back-relation, by design).
  const userIds = [...new Set(coupon.redemptions.map((r) => r.userId))];
  const orderIds = [...new Set(coupon.redemptions.map((r) => r.orderId))];
  const [users, orders] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const orderNumber = new Map(orders.map((o) => [o.id, o.orderNumber]));

  return {
    ...toSummary(coupon),
    redemptions: coupon.redemptions.map((r) => ({
      id: r.id,
      customerName: userName.get(r.userId) ?? "Unknown",
      orderNumber: orderNumber.get(r.orderId) ?? "—",
      discountAmount: r.discountAmount.toFixed(2),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function create(input: CreateCouponInput): Promise<AdminCouponSummary> {
  const data = createCouponSchema.parse(input);
  const code = normalizeCode(data.code);

  const clash = await db.coupon.findUnique({ where: { code }, select: { id: true } });
  if (clash) throw new CouponCodeTakenError(code);

  const created = await db.coupon.create({
    data: {
      code,
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? 0,
      totalUsageLimit: data.totalUsageLimit ?? null,
      perCustomerLimit: data.perCustomerLimit ?? null,
      validFrom: data.validFrom ?? null,
      validUntil: data.validUntil ?? null,
      isActive: data.isActive ?? true,
    },
    include: { _count: { select: { redemptions: true } } },
  });
  return toSummary(created);
}

export async function update(id: string, input: UpdateCouponInput): Promise<void> {
  const data = updateCouponSchema.parse(input);

  const existing = await db.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new CouponNotFoundError();

  // Renaming to a code another coupon already holds is a conflict.
  let code: string | undefined;
  if (data.code !== undefined) {
    code = normalizeCode(data.code);
    const clash = await db.coupon.findFirst({
      where: { code, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new CouponCodeTakenError(code);
  }

  await db.coupon.update({
    where: { id },
    data: {
      ...(code !== undefined ? { code } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
      ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
      ...(data.minOrderAmount !== undefined ? { minOrderAmount: data.minOrderAmount } : {}),
      ...(data.totalUsageLimit !== undefined ? { totalUsageLimit: data.totalUsageLimit } : {}),
      ...(data.perCustomerLimit !== undefined ? { perCustomerLimit: data.perCustomerLimit } : {}),
      ...(data.validFrom !== undefined ? { validFrom: data.validFrom } : {}),
      ...(data.validUntil !== undefined ? { validUntil: data.validUntil } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

/** Soft-disable: keeps the coupon (and its redemptions) but stops new uses. */
export async function deactivate(id: string): Promise<void> {
  const existing = await db.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new CouponNotFoundError();
  await db.coupon.update({ where: { id }, data: { isActive: false } });
}

/** Hard-delete — allowed ONLY when the coupon has never been redeemed. */
export async function remove(id: string): Promise<void> {
  const coupon = await db.coupon.findUnique({
    where: { id },
    select: { id: true, _count: { select: { redemptions: true } } },
  });
  if (!coupon) throw new CouponNotFoundError();
  if (coupon._count.redemptions > 0) {
    throw new CouponHasRedemptionsError(coupon._count.redemptions);
  }
  await db.coupon.delete({ where: { id } });
}
