// Shared order shapes (Phase C.2), used by the order service, the
// /api/v1/me/orders/[orderNumber] response, and the confirmation/detail page.
// Money is decimal-as-string on the wire; dates are ISO 8601 UTC strings.
// Deliberately excludes Manufacturing internals — customers never see those.

import type {
  DeliveryZone,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

/** Order.shippingAddress JSON snapshot, frozen at placement time (ADR-004). */
export type ShippingAddressSnapshot = {
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  district: string;
  postalCode: string;
};

export type OrderItemView = {
  /** From productSnapshot — the name at purchase time, not the live one. */
  name: string;
  sku: string;
  quantity: number;
  /** Price at placement, decimal-as-string (ADR-005). */
  unitPrice: string;
  lineTotal: string;
};

/** One row in the customer's order-history list (Phase D.1). Lightweight —
 * no address, no line items, no payment internals. `firstItemName`/`slug`
 * come from the first OrderItem's productSnapshot, for the card label +
 * placeholder illustration. */
export type OrderSummary = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryZone: DeliveryZone;
  total: string;
  /** Sum of item quantities across the order. */
  itemCount: number;
  firstItemName: string;
  firstItemSlug: string;
};

/** Paginated order-history response (matches the API list convention). */
export type OrderListResult = {
  data: OrderSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OrderDetailView = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  /** Explicit zone chosen at checkout (ADR-016) — drives the delivery label. */
  deliveryZone: DeliveryZone;
  subtotal: string;
  deliveryCharge: string;
  total: string;
  currency: string;
  shippingAddress: ShippingAddressSnapshot;
  contactPhone: string;
  deliveryNotes: string | null;
  createdAt: string;
  items: OrderItemView[];
  /** Payment intent + any proof the customer has submitted (Phase D.2). The
   * proof fields are null until they submit; screenshotUrl stays null if they
   * submit without an image. */
  payment: {
    status: PaymentStatus;
    transactionId: string | null;
    senderNumber: string | null;
    paidAmount: string | null;
    screenshotUrl: string | null;
  };
};
