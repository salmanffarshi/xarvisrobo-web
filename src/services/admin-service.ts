// Admin-wide business logic (Phase E.1). This first function is a read-only
// aggregate for the dashboard home — no per-user scoping, no mutations. Per
// ADR-003 the route handler is thin glue and calls this; the future admin
// tooling / mobile ops app reuse the same function.

import { db } from "@/lib/db";
import type { AdminDashboardStats } from "@/types/admin";

/**
 * Aggregate order-book stats for the admin dashboard home. Counts come from a
 * single `groupBy(status)` (one query for all nine buckets) rather than nine
 * separate counts; customers and revenue are their own aggregates; recent
 * orders is one bounded query. Nothing loads full order rows for the counts.
 */
export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const [statusGroups, totalCustomers, revenueAgg, recent] = await Promise.all([
    db.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    // Revenue counts DELIVERED orders only — the conservative figure (money we
    // have actually earned and shipped). We can widen this later (e.g. include
    // SHIPPED, or paid-but-in-production) once the operator decides what
    // "revenue" should mean for the business.
    db.order.aggregate({
      _sum: { total: true },
      where: { status: "DELIVERED" },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        total: true,
        user: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    }),
  ]);

  // Fold the grouped rows into a status → count lookup; a status with zero
  // orders is simply absent from the groupBy result, so default to 0.
  const countByStatus = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const count = (status: Parameters<typeof countByStatus.get>[0]): number =>
    countByStatus.get(status) ?? 0;

  const totalOrdersExclCancelled = statusGroups
    .filter((group) => group.status !== "CANCELLED")
    .reduce((sum, group) => sum + group._count._all, 0);

  return {
    needsAction: {
      pendingPaymentVerifications: count("WAITING_FOR_PAYMENT_VERIFICATION"),
      pendingCodConfirmations: count("WAITING_FOR_ORDER_CONFIRMATION"),
    },
    inProgress: {
      awaitingPayment: count("WAITING_FOR_PAYMENT"),
      readyToProduce: count("PAYMENT_VERIFIED") + count("ORDER_CONFIRMED"),
      inProduction: count("IN_PRODUCTION"),
      shipped: count("SHIPPED"),
    },
    totals: {
      totalOrders: totalOrdersExclCancelled,
      deliveredOrders: count("DELIVERED"),
      cancelledOrders: count("CANCELLED"),
      totalCustomers,
      revenue: (revenueAgg._sum.total ?? 0).toFixed(2),
    },
    recentOrders: recent.map((order) => ({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentMethod: order.paymentMethod,
      total: order.total.toFixed(2),
      customerName: order.user.name,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  };
}
