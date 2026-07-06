import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import { auth } from "@/auth";
import {
  paymentGeneralNote,
  paymentReceivingDetails,
  type PrepaidMethod,
} from "@/config/payment";
import { formatBdt } from "@/lib/format";
import { getOrderForCustomer } from "@/services/order-service";
import type { OrderDetailView } from "@/types/order";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Order details",
};

// Customer-facing status labels only — Manufacturing internals are staff-only
// (ADR-006) and never appear on this page.
const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT_VERIFICATION: "Awaiting payment verification",
  PAYMENT_VERIFIED: "Payment verified",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function PaymentInstructions({ order }: { order: OrderDetailView }) {
  if (order.paymentMethod === "COD") {
    return (
      <p className="text-sm text-neutral-600">
        Pay {formatBdt(order.total)} in cash on delivery (includes{" "}
        {formatBdt(order.deliveryCharge)} delivery). We&apos;ve started
        preparing your order.
      </p>
    );
  }

  const method = order.paymentMethod as PrepaidMethod;
  const details = paymentReceivingDetails[method];

  return (
    <div className="space-y-3 text-sm text-neutral-600">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        {"bankName" in details ? (
          <>
            <dt className="text-neutral-500">Bank</dt>
            <dd className="font-medium text-neutral-900">{details.bankName}</dd>
            <dt className="text-neutral-500">Account name</dt>
            <dd className="font-medium text-neutral-900">
              {details.accountName}
            </dd>
            <dt className="text-neutral-500">Account number</dt>
            <dd className="font-medium tabular-nums text-neutral-900">
              {details.accountNumber}
            </dd>
            <dt className="text-neutral-500">Branch</dt>
            <dd className="font-medium text-neutral-900">{details.branch}</dd>
            {details.routingNumber && (
              <>
                <dt className="text-neutral-500">Routing number</dt>
                <dd className="font-medium tabular-nums text-neutral-900">
                  {details.routingNumber}
                </dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="text-neutral-500">
              {method === "BKASH" ? "bKash" : "Nagad"} number
            </dt>
            <dd className="font-medium tabular-nums text-neutral-900">
              {details.number}
            </dd>
            <dt className="text-neutral-500">Account type</dt>
            <dd className="font-medium text-neutral-900 capitalize">
              {details.accountType}
            </dd>
          </>
        )}
        <dt className="text-neutral-500">Amount to send</dt>
        <dd className="font-medium tabular-nums text-neutral-900">
          {formatBdt(order.total)}
        </dd>
        <dt className="text-neutral-500">Reference</dt>
        <dd className="font-medium text-neutral-900">{order.orderNumber}</dd>
      </dl>
      {details.instructions && <p>{details.instructions}</p>}
      <p>{paymentGeneralNote}</p>
      <p className="text-neutral-500">
        You&apos;ll be able to submit your payment confirmation from your
        account soon.
      </p>
    </div>
  );
}

// Order confirmation + detail page (Phase C.2). Doubles as the post-checkout
// confirmation (?placed=1 shows the banner) and the revisitable order detail.
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const [session, { orderNumber }, { placed }] = await Promise.all([
    auth(),
    params,
    searchParams,
  ]);

  // Ownership: an unowned order is indistinguishable from a nonexistent one.
  const order = await getOrderForCustomer(session!.user.id, orderNumber);
  if (!order) {
    notFound();
  }

  const orderDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Dhaka",
  }).format(new Date(order.createdAt));

  return (
    <section>
      {placed === "1" && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900">
              Order placed. Thank you.
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Your order number is{" "}
              <span className="font-semibold">{order.orderNumber}</span>.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Order {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Placed {orderDate}</p>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <div className="mt-8 space-y-6">
        {/* Items + totals */}
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-sm font-medium text-neutral-500">Items</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {order.items.map((item) => (
              <li
                key={item.sku}
                className="flex items-baseline justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0 text-neutral-900">
                  {item.name}{" "}
                  <span className="text-neutral-500">
                    × {item.quantity} · {formatBdt(item.unitPrice)} each
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900">
                  {formatBdt(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-neutral-200 pt-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">Subtotal</span>
              <span className="tabular-nums">{formatBdt(order.subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">Delivery charge</span>
              <span className="tabular-nums">
                {formatBdt(order.deliveryCharge)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-neutral-100 pt-3 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatBdt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment instructions */}
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-sm font-medium text-neutral-500">
            {order.paymentMethod === "COD"
              ? "Cash on delivery"
              : "How to pay"}
          </h2>
          <div className="mt-3">
            <PaymentInstructions order={order} />
          </div>
        </div>

        {/* Shipping address (frozen snapshot — ADR-004) + contact */}
        <div className="rounded-2xl border border-neutral-200 p-6">
          <h2 className="text-sm font-medium text-neutral-500">
            Shipping address
          </h2>
          <div className="mt-3 text-sm text-neutral-600">
            <p className="font-medium text-neutral-900">
              {order.shippingAddress.recipientName}{" "}
              <span className="font-normal text-neutral-500">
                ({order.shippingAddress.label})
              </span>
            </p>
            <p className="mt-1">
              {order.shippingAddress.streetAddress},{" "}
              {order.shippingAddress.city}, {order.shippingAddress.district}{" "}
              {order.shippingAddress.postalCode}
            </p>
            <p className="mt-3">
              <span className="text-neutral-500">Contact phone:</span>{" "}
              {order.contactPhone}
            </p>
            {order.deliveryNotes && (
              <p className="mt-1">
                <span className="text-neutral-500">Delivery notes:</span>{" "}
                {order.deliveryNotes}
              </p>
            )}
          </div>
        </div>
      </div>

      <Link
        href="/products"
        className="mt-8 inline-block text-sm text-neutral-600 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline"
      >
        Continue shopping
      </Link>
    </section>
  );
}
