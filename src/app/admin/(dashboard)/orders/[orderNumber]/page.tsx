import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ManufacturingStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth-guards";
import { DELIVERY_ZONE_LABELS } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";
import {
  ADMIN_ORDER_STATUS_LABELS,
  STATUS_TONE_CLASSES,
  statusTone,
} from "@/lib/order-status";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
} from "@/lib/payment-display";
import { cn } from "@/lib/utils";
import { adminGetOrder } from "@/services/order-service";
import { OrderActionPanel } from "./order-action-panel";

// Admin order detail (Phase E.2.1) — READ ONLY. Staff see internal truth: raw
// payment status, manufacturing stage, and the full status-history audit trail.
// The action buttons (verify/confirm/advance/cancel) are E.2.2 — a placeholder
// region marks where they'll go; nothing here mutates.

// Internal manufacturing-stage labels (staff context — fine to show, ADR-006).
const MANUFACTURING_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  WAITING_FOR_PRODUCTION: "Waiting for Production",
  COMPONENTS_COLLECTED: "Components Collected",
  ASSEMBLY: "Assembly",
  FIRMWARE_INSTALLED: "Firmware Installed",
  TESTING: "Testing",
  QC: "QC",
  PACKAGING: "Packaging",
  READY_TO_SHIP: "Ready to Ship",
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A labelled value row for the definition-style panels. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  await requireStaffPage();
  const { orderNumber } = await params;
  const order = await adminGetOrder(orderNumber);
  if (!order) {
    notFound();
  }

  const { payment } = order;
  // Proof is "submitted" once the customer has attached a txn id or screenshot.
  const hasProof = Boolean(payment.transactionId || payment.screenshotUrl);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} />
        All orders
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
            {order.orderNumber}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Placed {dateTimeFormatter.format(new Date(order.createdAt))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "border-transparent",
              STATUS_TONE_CLASSES[statusTone(order.status)],
            )}
          >
            {ADMIN_ORDER_STATUS_LABELS[order.status]}
          </Badge>
          <Badge variant="outline">
            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "border-transparent",
              PAYMENT_STATUS_CLASSES[payment.status],
            )}
          >
            Payment: {PAYMENT_STATUS_LABELS[payment.status]}
          </Badge>
        </div>
      </header>

      {/* Order actions (E.2.2) — renders only the legal actions for this status,
          from the same rules the server guards enforce (legalNextActions). */}
      <OrderActionPanel
        orderNumber={order.orderNumber}
        status={order.status}
        paymentMethod={order.paymentMethod}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Customer */}
        <Section title="Customer">
          <dl>
            <Row label="Name" value={order.customerName} />
            <Row label="Email" value={order.customerEmail} />
            <Row label="Contact phone" value={order.contactPhone} />
          </dl>
        </Section>

        {/* Shipping address (snapshot) */}
        <Section title="Shipping address">
          <div className="text-sm">
            <p className="font-medium">{order.shippingAddress.recipientName}</p>
            <p className="text-muted-foreground mt-1">
              {order.shippingAddress.phone}
            </p>
            <p className="mt-2">{order.shippingAddress.streetAddress}</p>
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.district}
              {order.shippingAddress.postalCode
                ? ` — ${order.shippingAddress.postalCode}`
                : ""}
            </p>
            <p className="text-muted-foreground mt-2">
              Delivery zone: {DELIVERY_ZONE_LABELS[order.deliveryZone]}
            </p>
          </div>
        </Section>
      </div>

      {/* Items + totals */}
      <div className="mt-4">
        <Section title="Items">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Unit</th>
                  <th className="py-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.sku} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{item.name}</td>
                    <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                      {item.sku}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatBdt(item.unitPrice)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatBdt(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 border-t pt-4">
            <Row label="Subtotal" value={formatBdt(order.subtotal)} />
            {order.discountAmount !== "0.00" && (
              <Row
                label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
                value={`−${formatBdt(order.discountAmount)}`}
              />
            )}
            <Row
              label={`Delivery (${DELIVERY_ZONE_LABELS[order.deliveryZone]})`}
              value={formatBdt(order.deliveryCharge)}
            />
            <div className="flex justify-between gap-4 border-t pt-2 text-sm">
              <dt className="font-semibold">Total</dt>
              <dd className="font-semibold tabular-nums">
                {formatBdt(order.total)}
              </dd>
            </div>
          </dl>
        </Section>
      </div>

      {order.deliveryNotes && (
        <div className="mt-4">
          <Section title="Delivery notes">
            <p className="text-sm">{order.deliveryNotes}</p>
          </Section>
        </div>
      )}

      {/* Payment details */}
      <div className="mt-4">
        <Section title="Payment">
          {hasProof ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <dl className="flex-1">
                <Row
                  label="Method"
                  value={PAYMENT_METHOD_LABELS[payment.method]}
                />
                <Row label="Status" value={PAYMENT_STATUS_LABELS[payment.status]} />
                <Row
                  label="Transaction ID"
                  value={payment.transactionId ?? "—"}
                />
                <Row label="Sender number" value={payment.senderNumber ?? "—"} />
                {payment.verifiedAt && (
                  <Row
                    label="Verified at"
                    value={dateTimeFormatter.format(new Date(payment.verifiedAt))}
                  />
                )}
              </dl>
              {payment.screenshotUrl && (
                <a
                  href={payment.screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={payment.screenshotUrl}
                    alt="Payment screenshot"
                    className="size-28 rounded-lg border object-cover"
                  />
                </a>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No payment proof submitted yet.
            </p>
          )}

          {payment.rejectionReason && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <span className="font-medium">Rejection reason:</span>{" "}
              {payment.rejectionReason}
            </div>
          )}
        </Section>
      </div>

      {/* Manufacturing (internal) */}
      <div className="mt-4">
        <Section title="Manufacturing">
          {order.manufacturingStatus ? (
            <Badge variant="secondary">
              {MANUFACTURING_STATUS_LABELS[order.manufacturingStatus]}
            </Badge>
          ) : (
            <p className="text-muted-foreground text-sm">Not in production yet.</p>
          )}
        </Section>
      </div>

      {/* Status history */}
      <div className="mt-4">
        <Section title="Status history">
          <ol className="space-y-4">
            {order.statusHistory.map((entry, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {entry.fromStatus
                      ? `${ADMIN_ORDER_STATUS_LABELS[entry.fromStatus]} → ${ADMIN_ORDER_STATUS_LABELS[entry.toStatus]}`
                      : ADMIN_ORDER_STATUS_LABELS[entry.toStatus]}
                  </p>
                  {entry.note && (
                    <p className="text-muted-foreground mt-0.5">{entry.note}</p>
                  )}
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {entry.changedBy} ·{" "}
                    {dateTimeFormatter.format(new Date(entry.createdAt))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  );
}
