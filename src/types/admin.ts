// Admin dashboard view types (Phase E.1). The stats are a read-only aggregate
// of the whole order book — counts grouped by the ADR-016 OrderStatus, plus
// totals and the newest orders — shaped for the dashboard home and reusable by
// the /api/v1/admin/dashboard/stats endpoint.

import type { OrderStatus, PaymentMethod } from "@prisma/client";

/** One row in the "recent orders" list — the 10 newest orders, admin view. */
export interface AdminRecentOrder {
  orderNumber: string;
  createdAt: string; // ISO 8601
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: string; // decimal string, e.g. "24500.00"
  customerName: string;
  itemCount: number;
}

export interface AdminDashboardStats {
  /** The actionable queues an operator should clear first. */
  needsAction: {
    pendingPaymentVerifications: number; // WAITING_FOR_PAYMENT_VERIFICATION
    pendingCodConfirmations: number; // WAITING_FOR_ORDER_CONFIRMATION
  };
  /** Orders moving through the pipeline (not yet a queue that needs a decision). */
  inProgress: {
    awaitingPayment: number; // WAITING_FOR_PAYMENT
    readyToProduce: number; // PAYMENT_VERIFIED + ORDER_CONFIRMED (gate passed)
    inProduction: number; // IN_PRODUCTION
    shipped: number; // SHIPPED
  };
  totals: {
    totalOrders: number; // all orders excluding CANCELLED
    deliveredOrders: number; // DELIVERED
    cancelledOrders: number; // CANCELLED
    totalCustomers: number; // users with role CUSTOMER
    revenue: string; // decimal string; sum of DELIVERED order totals
  };
  recentOrders: AdminRecentOrder[];
}
