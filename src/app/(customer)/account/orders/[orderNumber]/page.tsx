import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { auth } from "@/auth";
import { formatBdt } from "@/lib/format";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { getOrderForCustomer } from "@/services/order-service";
import { getSettings } from "@/services/settings-service";
import { Badge } from "@/components/ui/badge";
import { OrderStatusTracker } from "@/components/order/order-status-tracker";
import { OrderActionBlock } from "@/components/order/order-action-block";

export const metadata: Metadata = {
  title: "Order details",
};

// Subtle badge coloring by tone, within the site's restrained palette.
const TONE_CLASSES: Record<ReturnType<typeof statusTone>, string> = {
  pending: "bg-amber-50 text-amber-700",
  progress: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  terminal: "bg-neutral-100 text-neutral-600",
};

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

  // Payment-receiving details + WhatsApp number for the action block, from the
  // admin-editable Settings row (Phase E.4).
  const settings = await getSettings();

  const orderDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Dhaka",
  }).format(new Date(order.createdAt));

  return (
    <section>
      <Link
        href="/account/orders"
        className="mb-6 inline-block text-sm text-neutral-600 underline-offset-4 transition-colors hover:text-neutral-900 hover:underline"
      >
        ← All orders
      </Link>

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
        <Badge
          variant="secondary"
          className={cn(
            "rounded-full px-3 py-1",
            TONE_CLASSES[statusTone(order.status)],
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <div className="mt-8 space-y-6">
        {/* Status journey (Phase D.1) — method-aware; distinct treatment when
            cancelled. Reads customer-facing status only (ADR-006). */}
        <OrderStatusTracker
          paymentMethod={order.paymentMethod}
          status={order.status}
        />

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
            {order.discountAmount !== "0.00" && (
              <div className="flex items-baseline justify-between text-emerald-700">
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span className="tabular-nums">
                  −{formatBdt(order.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">Delivery charge</span>
              <span className="tabular-nums">
                {order.deliveryCharge === "0.00"
                  ? "Free"
                  : formatBdt(order.deliveryCharge)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-neutral-100 pt-3 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatBdt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment / action block (Phase D.2) — gated: renders only for
            actionable states, nothing otherwise (cancelled/delivered/etc). */}
        <OrderActionBlock order={order} settings={settings} />

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
