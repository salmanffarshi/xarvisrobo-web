// Admin dashboard view types (Phase E.1). The stats are a read-only aggregate
// of the whole order book — counts grouped by the ADR-016 OrderStatus, plus
// totals and the newest orders — shaped for the dashboard home and reusable by
// the /api/v1/admin/dashboard/stats endpoint.

import type {
  DeliveryZone,
  ManufacturingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

import type { ShippingAddressSnapshot } from "@/types/order";

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
    returnedOrders: number; // RETURNED (Phase F)
    cancelledOrders: number; // CANCELLED
    totalCustomers: number; // users with role CUSTOMER
    revenue: string; // decimal string; recognized revenue (payment VERIFIED, not returned/cancelled)
    returnedValue: string; // decimal string; revenue reversed by returns (sum of RETURNED totals) (Phase F)
  };
  recentOrders: AdminRecentOrder[];
}

// ============================================================================
// ADMIN ORDER READS (Phase E.2.1) — the staff order list + detail. Unlike the
// customer order types, these carry internal truth: the raw Payment status,
// manufacturing stage, and the full status-history audit trail.
// ============================================================================

/** One row in the admin order list. Lightweight — enough for the table. */
export interface AdminOrderSummary {
  orderNumber: string;
  createdAt: string; // ISO 8601
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryZone: DeliveryZone;
  total: string; // decimal string
  customerName: string;
  customerEmail: string;
  itemCount: number; // sum of item quantities
  paymentStatus: PaymentStatus; // from the Payment row
  hasScreenshot: boolean; // a proof screenshot was submitted
}

export interface AdminOrderListResult {
  data: AdminOrderSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** One line item on the admin order detail (from the OrderItem snapshot). */
export interface AdminOrderItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string; // decimal string
  lineTotal: string; // decimal string
}

/** One entry in the status-history timeline, oldest→newest. `changedBy` is the
 * resolved actor name, or "Customer" when the changer is the order's own owner
 * (e.g. their payment-proof submission). */
export interface AdminOrderHistoryEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  note: string | null;
  createdAt: string; // ISO 8601
}

/** Full staff view of one order — customer, items, address snapshot, payment
 * internals, manufacturing stage (if any), and the audit trail. */
export interface AdminOrderDetail {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryZone: DeliveryZone;
  subtotal: string;
  /** Coupon snapshot on the order (Phase E.5); null/"0.00" when none. */
  couponCode: string | null;
  discountAmount: string;
  deliveryCharge: string;
  total: string;
  currency: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  contactPhone: string;
  deliveryNotes: string | null;
  shippingAddress: ShippingAddressSnapshot;
  items: AdminOrderItem[];
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId: string | null;
    senderNumber: string | null;
    screenshotUrl: string | null;
    rejectionReason: string | null;
    verifiedAt: string | null; // ISO 8601
  };
  /** null when no Manufacturing row exists yet (order not past the production
   * gate — ADR-016). */
  manufacturingStatus: ManufacturingStatus | null;
  statusHistory: AdminOrderHistoryEntry[];
}
