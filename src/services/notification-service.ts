import "server-only";

// Notification dispatcher (Phase I, ADR-003). One function per order event; each
// builds the content and fires the channel(s) — customer email via the Phase G
// sendEmail helper, admin alerts via the Telegram client.
//
// CORE PRINCIPLE — notifications are AFTER-COMMIT, BEST-EFFORT, NON-BLOCKING.
// Every function is async and fully wrapped in try/catch: a failed email or
// Telegram send is logged, never thrown. Callers fire-and-forget with
// `void notify...(orderNumber)` immediately AFTER their transaction commits — a
// notification can never roll back or break the order operation. The read model
// is loaded here with a PLAIN read (db.order.findUnique), never inside a
// transaction, so no tx is held open across a network call.

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
import { getSettings } from "@/services/settings-service";

// Absolute base for links in emails — same fallback chain as password-reset.
const APP_URL =
  process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function orderUrl(orderNumber: string): string {
  return `${APP_URL}/account/orders/${orderNumber}`;
}

/** The read model both channels build from — OrderEmailData plus the customer's
 * email address (the To). */
type OrderNotification = OrderEmailData & { customerEmail: string };

/**
 * Plain read (NOT a transaction) of everything a notification needs. Returns null
 * if the order vanished between commit and this read (nothing to send).
 */
async function loadOrder(orderNumber: string): Promise<OrderNotification | null> {
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
}

/** Escape user-supplied text for Telegram's HTML parse_mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- CUSTOMER EMAILS -------------------------------------------------------

export async function notifyOrderPlaced(orderNumber: string): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const settings = await getSettings();
    const { subject, html, text } = orderPlacedEmail(
      order,
      settings,
      orderUrl(orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] order-placed failed:", err);
  }
}

export async function notifyPreparing(orderNumber: string): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const { subject, html, text } = orderPreparingEmail(order, orderUrl(orderNumber));
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] preparing failed:", err);
  }
}

export async function notifyShipped(orderNumber: string): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const { subject, html, text } = orderShippedEmail(order, orderUrl(orderNumber));
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] shipped failed:", err);
  }
}

export async function notifyDelivered(orderNumber: string): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const { subject, html, text } = orderDeliveredEmail(order, orderUrl(orderNumber));
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] delivered failed:", err);
  }
}

export async function notifyPaymentRejected(
  orderNumber: string,
  reason: string,
): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const { subject, html, text } = paymentRejectedEmail(
      order,
      reason,
      orderUrl(orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] payment-rejected failed:", err);
  }
}

export async function notifyCancelled(
  orderNumber: string,
  reason: string,
): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
    const { subject, html, text } = orderCancelledEmail(
      order,
      reason,
      orderUrl(orderNumber),
    );
    await sendEmail({ to: order.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[notify] cancelled failed:", err);
  }
}

// --- ADMIN TELEGRAM --------------------------------------------------------

export async function notifyAdminNewOrder(orderNumber: string): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
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
  orderNumber: string,
): Promise<void> {
  try {
    const order = await loadOrder(orderNumber);
    if (!order) return;
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
