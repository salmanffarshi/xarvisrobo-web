import "server-only";

// Notification dispatcher (Phase I, ADR-003). One function per order event; each
// builds the content and fires the channel(s) — customer email via the Phase G
// sendEmail helper, admin alerts via the Telegram client.
//
// CORE PRINCIPLE — notifications are AFTER-COMMIT, BEST-EFFORT, NON-BLOCKING.
// Every sender is async and fully wrapped in try/catch: a failed email or
// Telegram send is logged, never thrown.
//
// PAYLOAD, NOT orderNumber. Each notify* takes a pre-built `OrderNotification`
// and does NO DB read of its own. The caller supplies the data:
//   - placeOrder builds it from what its transaction already computed (zero
//     post-commit reads on the hot checkout path);
//   - the admin hooks, which don't hold the full order, use
//     `withOrderNotification(orderNumber, send)` — ONE plain read, then send.
// Callers schedule the send with Next's `after()` (runs after the response is
// sent, and Vercel keeps the function alive until it finishes). This replaced the
// old `void notify...()` fire-and-forget, which on Vercel left the send — and its
// re-query — orphaned on a frozen function, timing out on connection acquisition
// (P2024). No send ever runs inside a transaction.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/client";
import {
  orderCancelledEmail,
  orderDeliveredEmail,
  orderPlacedEmail,
  orderPreparingEmail,
  orderShippedEmail,
  paymentRejectedEmail,
  type OrderEmailData,
} from "@/lib/email/templates/order";
import { DELIVERY_ZONE_LABELS } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-display";
import { sendTelegram } from "@/lib/telegram";

import type { Settings } from "@prisma/client";

// Absolute base for links in emails — same fallback chain as password-reset.
const APP_URL =
  process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function orderUrl(orderNumber: string): string {
  return `${APP_URL}/account/orders/${orderNumber}`;
}

/** The read model both channels build from — OrderEmailData plus the customer's
 * email address (the To). Built either from data a service already holds
 * (placeOrder — no DB read) or by `withOrderNotification`'s plain read (admin
 * hooks). */
export type OrderNotification = OrderEmailData & { customerEmail: string };

/**
 * Plain read (NOT a transaction) of everything a notification needs. Best-effort:
 * returns null — logged, never thrown — if the order vanished between commit and
 * this read, or if the read itself failed, so a caller (and `after()`) never sees
 * an exception.
 */
async function loadOrderNotification(
  orderNumber: string,
): Promise<OrderNotification | null> {
  try {
    const order = await db.order.findUnique({
      where: { orderNumber },
      include: {
        user: { select: { name: true, email: true } },
        items: {
          orderBy: { id: "asc" },
          select: { quantity: true, lineTotal: true, productSnapshot: true },
        },
      },
    });
    if (!order) {
      return null;
    }

    return {
      orderNumber: order.orderNumber,
      customerName: order.user.name,
      customerEmail: order.user.email,
      paymentMethod: order.paymentMethod,
      deliveryZone: order.deliveryZone,
      contactPhone: order.contactPhone,
      subtotal: order.subtotal.toFixed(2),
      discountAmount: order.discountAmount.toFixed(2),
      couponCode: order.couponCode,
      deliveryCharge: order.deliveryCharge.toFixed(2),
      total: order.total.toFixed(2),
      items: order.items.map((item) => {
        const snapshot = item.productSnapshot as { name: string };
        return {
          name: snapshot.name,
          quantity: item.quantity,
          lineTotal: item.lineTotal.toFixed(2),
        };
      }),
    };
  } catch (err) {
    console.error("[notify] load order failed:", err);
    return null;
  }
}

/**
 * For hooks that DON'T already hold the order data (the admin actions): load the
 * payload with ONE plain read, then run `send`. Best-effort — never throws, so it
 * is safe to hand straight to `after()`. Because it runs inside `after()`, the
 * read is NOT orphaned on a serverless freeze (the P2024 the old void-fire caused).
 * placeOrder does NOT use this — it builds the payload from data already in its
 * transaction, so its hot path does zero post-commit reads.
 */
export async function withOrderNotification(
  orderNumber: string,
  send: (order: OrderNotification) => Promise<void>,
): Promise<void> {
  const order = await loadOrderNotification(orderNumber);
  if (order) {
    await send(order);
  }
}

/** Escape user-supplied text for Telegram's HTML parse_mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- CUSTOMER EMAILS -------------------------------------------------------

export async function notifyOrderPlaced(
  order: OrderNotification,
  settings: Settings,
): Promise<void> {
  try {
    const { subject, html, text } = orderPlacedEmail(
      order,
      settings,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] order-placed failed:", err);
  }
}

export async function notifyPreparing(order: OrderNotification): Promise<void> {
  try {
    const { subject, html, text } = orderPreparingEmail(
      order,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] preparing failed:", err);
  }
}

export async function notifyShipped(order: OrderNotification): Promise<void> {
  try {
    const { subject, html, text } = orderShippedEmail(
      order,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] shipped failed:", err);
  }
}

export async function notifyDelivered(order: OrderNotification): Promise<void> {
  try {
    const { subject, html, text } = orderDeliveredEmail(
      order,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] delivered failed:", err);
  }
}

export async function notifyPaymentRejected(
  order: OrderNotification,
  reason: string,
): Promise<void> {
  try {
    const { subject, html, text } = paymentRejectedEmail(
      order,
      reason,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] payment-rejected failed:", err);
  }
}

export async function notifyCancelled(
  order: OrderNotification,
  reason: string,
): Promise<void> {
  try {
    const { subject, html, text } = orderCancelledEmail(
      order,
      reason,
      orderUrl(order.orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] cancelled failed:", err);
  }
}

// --- ADMIN TELEGRAM --------------------------------------------------------

export async function notifyAdminNewOrder(
  order: OrderNotification,
): Promise<void> {
  try {
    const items = order.items
      .map((item) => ` • ${item.quantity}× ${escapeHtml(item.name)}`)
      .join("\n");
    const text = [
      `🛒 <b>New order ${escapeHtml(order.orderNumber)}</b>`,
      `Customer: ${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)})`,
      "Items:",
      items,
      `Total: ${formatBdt(order.total)}`,
      `Method: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
      `Zone: ${DELIVERY_ZONE_LABELS[order.deliveryZone]}`,
    ].join("\n");
    await sendTelegram(text);
  } catch (err) {
    console.error("[notify] admin-new-order failed:", err);
  }
}

export async function notifyAdminProofSubmitted(
  order: OrderNotification,
): Promise<void> {
  try {
    const text = [
      `💳 <b>Payment proof submitted — ${escapeHtml(order.orderNumber)}</b>`,
      `Customer: ${escapeHtml(order.customerName)}`,
      `Method: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
      `Total: ${formatBdt(order.total)}`,
      "Please verify it in the admin dashboard.",
    ].join("\n");
    await sendTelegram(text);
  } catch (err) {
    console.error("[notify] admin-proof-submitted failed:", err);
  }
}
