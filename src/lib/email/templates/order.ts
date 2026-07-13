// Order notification email templates (Phase I). Pure functions — each takes its
// data and returns { subject, html, text } with no side effects and no Resend
// import (sent via the Phase G sendEmail helper). Siblings of password-reset.ts.
//
// CUSTOMER WORDING ONLY: these are customer-facing, so they use "preparing" (never
// "In Production" / build-to-order internals) — matching ORDER_STATUS_LABELS.
//
// The email chrome (light card, inlined styles because clients strip <style>) is
// shared by one small layout helper so all six emails read as one on-brand set.

import type { Settings } from "@prisma/client";

import { DELIVERY_ZONE_LABELS } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";

import type { EmailContent } from "./password-reset";

/** The order data every order email needs. Built by the notification service from
 * a plain (non-transactional) read after the order operation commits. */
export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  paymentMethod: "BKASH" | "NAGAD" | "COD";
  deliveryZone: "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
  contactPhone: string;
  subtotal: string;
  discountAmount: string;
  couponCode: string | null;
  deliveryCharge: string;
  total: string;
  items: { name: string; quantity: number; lineTotal: string }[];
}

// --- shared pieces ---------------------------------------------------------

function greeting(name: string): string {
  return name ? `Hi ${name},` : "Hi,";
}

/** Wrap body HTML in the shared card shell. `heading` is the big line at the top. */
function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#171717;">Xarvisrobo</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#171717;">${heading}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#a3a3a3;border-top:1px solid #f0f0f0;padding-top:20px;">
                  Xarvisrobo — AI-enabled desk robots, built in Bangladesh.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#525252;">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
    <tr>
      <td style="border-radius:9999px;background-color:#171717;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:9999px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Item lines + totals, shared by the placed email (and reused where a summary
 * helps). Uses formatBdt so money reads exactly as it does on the site. */
function orderSummary(order: OrderEmailData): string {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;font-size:14px;color:#171717;">${item.quantity}× ${item.name}</td>
        <td style="padding:6px 0;font-size:14px;color:#171717;text-align:right;white-space:nowrap;">${formatBdt(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    order.couponCode && order.discountAmount !== "0.00"
      ? `<tr>
          <td style="padding:2px 0;font-size:13px;color:#525252;">Discount (${order.couponCode})</td>
          <td style="padding:2px 0;font-size:13px;color:#525252;text-align:right;white-space:nowrap;">−${formatBdt(order.discountAmount)}</td>
        </tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;">
    <tr><td colspan="2" style="padding:12px 0 4px;"></td></tr>
    ${rows}
    <tr><td colspan="2" style="padding:6px 0;border-top:1px solid #f0f0f0;"></td></tr>
    <tr>
      <td style="padding:2px 0;font-size:13px;color:#525252;">Subtotal</td>
      <td style="padding:2px 0;font-size:13px;color:#525252;text-align:right;white-space:nowrap;">${formatBdt(order.subtotal)}</td>
    </tr>
    ${discountRow}
    <tr>
      <td style="padding:2px 0;font-size:13px;color:#525252;">Delivery</td>
      <td style="padding:2px 0;font-size:13px;color:#525252;text-align:right;white-space:nowrap;">${formatBdt(order.deliveryCharge)}</td>
    </tr>
    <tr>
      <td style="padding:8px 0 12px;font-size:15px;font-weight:600;color:#171717;">Total</td>
      <td style="padding:8px 0 12px;font-size:15px;font-weight:600;color:#171717;text-align:right;white-space:nowrap;">${formatBdt(order.total)}</td>
    </tr>
  </table>`;
}

/** Plain-text item + totals block, for the text fallback. */
function orderSummaryText(order: OrderEmailData): string {
  const lines = order.items.map(
    (item) => `  ${item.quantity}x ${item.name} — ${formatBdt(item.lineTotal)}`,
  );
  lines.push(`  Subtotal: ${formatBdt(order.subtotal)}`);
  if (order.couponCode && order.discountAmount !== "0.00") {
    lines.push(`  Discount (${order.couponCode}): -${formatBdt(order.discountAmount)}`);
  }
  lines.push(`  Delivery: ${formatBdt(order.deliveryCharge)}`);
  lines.push(`  Total: ${formatBdt(order.total)}`);
  return lines.join("\n");
}

// --- templates -------------------------------------------------------------

/**
 * Order placed. Prepaid (bKash/Nagad): shows payment instructions — receiving
 * number from Settings, amount, and "use order number as the reference". COD:
 * the "we'll call to confirm" note + delivery charge. Mirrors the confirmation
 * page's OrderActionBlock content.
 */
export function orderPlacedEmail(
  order: OrderEmailData,
  settings: Settings,
  orderUrl: string,
): EmailContent {
  const subject = `Order ${order.orderNumber} received — Xarvisrobo`;
  const isPrepaid = order.paymentMethod !== "COD";

  let paymentHtml: string;
  let paymentText: string;

  if (isPrepaid) {
    const isBkash = order.paymentMethod === "BKASH";
    const number = isBkash ? settings.bkashNumber : settings.nagadNumber;
    const accountType = isBkash ? settings.bkashType : settings.nagadType;
    const walletName = isBkash ? "bKash" : "Nagad";
    const instructions = isBkash
      ? settings.bkashInstructions
      : settings.nagadInstructions;

    paymentHtml =
      paragraph(`<strong style="color:#171717;">Complete your payment</strong>`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
        <tr><td style="padding:2px 0;font-size:14px;color:#525252;">${walletName} number (${accountType})</td><td style="padding:2px 0;font-size:14px;color:#171717;font-weight:600;text-align:right;">${number}</td></tr>
        <tr><td style="padding:2px 0;font-size:14px;color:#525252;">Amount</td><td style="padding:2px 0;font-size:14px;color:#171717;font-weight:600;text-align:right;">${formatBdt(order.total)}</td></tr>
        <tr><td style="padding:2px 0;font-size:14px;color:#525252;">Reference</td><td style="padding:2px 0;font-size:14px;color:#171717;font-weight:600;text-align:right;">${order.orderNumber}</td></tr>
      </table>` +
      paragraph(
        `Use your order number <strong style="color:#171717;">${order.orderNumber}</strong> as the reference when sending money.`,
      ) +
      (instructions ? paragraph(instructions) : "") +
      (settings.paymentGeneralNote ? paragraph(settings.paymentGeneralNote) : "") +
      paragraph("Once you've paid, submit your payment details in your account and we'll verify it.");

    paymentText = [
      "Complete your payment:",
      `  ${walletName} number (${accountType}): ${number}`,
      `  Amount: ${formatBdt(order.total)}`,
      `  Reference: ${order.orderNumber}`,
      `Use your order number ${order.orderNumber} as the reference when sending money.`,
      ...(instructions ? [instructions] : []),
      ...(settings.paymentGeneralNote ? [settings.paymentGeneralNote] : []),
      "Once you've paid, submit your payment details in your account and we'll verify it.",
    ].join("\n");
  } else {
    paymentHtml =
      paragraph(`<strong style="color:#171717;">Cash on delivery</strong>`) +
      paragraph(
        `Our team will call you at <strong style="color:#171717;">${order.contactPhone}</strong> to confirm your order before we begin. A delivery charge of ${formatBdt(order.deliveryCharge)} (${DELIVERY_ZONE_LABELS[order.deliveryZone]}) is payable on delivery.`,
      );
    paymentText = [
      "Cash on delivery:",
      `Our team will call you at ${order.contactPhone} to confirm your order before we begin.`,
      `A delivery charge of ${formatBdt(order.deliveryCharge)} (${DELIVERY_ZONE_LABELS[order.deliveryZone]}) is payable on delivery.`,
    ].join("\n");
  }

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(`Thanks for your order. We've received order <strong style="color:#171717;">${order.orderNumber}</strong> — here's a summary:`) +
    orderSummary(order) +
    paymentHtml +
    button(orderUrl, "View your order");

  const text = [
    greeting(order.customerName),
    "",
    `Thanks for your order. We've received order ${order.orderNumber} — here's a summary:`,
    "",
    orderSummaryText(order),
    "",
    paymentText,
    "",
    `View your order: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("Thanks for your order", bodyHtml), text };
}

/**
 * Preparing. Sent when a prepaid payment is verified or a COD order is confirmed
 * — both mean "we're now preparing your order" (never reveal build-to-order).
 */
export function orderPreparingEmail(
  order: OrderEmailData,
  orderUrl: string,
): EmailContent {
  const subject = `Order ${order.orderNumber} confirmed — we're preparing it`;
  const opener =
    order.paymentMethod === "COD"
      ? "Your order has been confirmed."
      : "Your payment has been received.";

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(
      `${opener} We're now preparing your order <strong style="color:#171717;">${order.orderNumber}</strong> and will let you know as soon as it ships.`,
    ) +
    button(orderUrl, "View your order");

  const text = [
    greeting(order.customerName),
    "",
    `${opener} We're now preparing your order ${order.orderNumber} and will let you know as soon as it ships.`,
    "",
    `View your order: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("We're preparing your order", bodyHtml), text };
}

/** Shipped. */
export function orderShippedEmail(
  order: OrderEmailData,
  orderUrl: string,
): EmailContent {
  const subject = `Order ${order.orderNumber} has shipped`;

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(
      `Good news — your order <strong style="color:#171717;">${order.orderNumber}</strong> is on its way.`,
    ) +
    button(orderUrl, "Track your order");

  const text = [
    greeting(order.customerName),
    "",
    `Good news — your order ${order.orderNumber} is on its way.`,
    "",
    `Track your order: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("Your order is on the way", bodyHtml), text };
}

/** Delivered. */
export function orderDeliveredEmail(
  order: OrderEmailData,
  orderUrl: string,
): EmailContent {
  const subject = `Order ${order.orderNumber} delivered`;

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(
      `Your order <strong style="color:#171717;">${order.orderNumber}</strong> has been delivered. We hope you love it — thank you for choosing Xarvisrobo.`,
    ) +
    button(orderUrl, "View your order");

  const text = [
    greeting(order.customerName),
    "",
    `Your order ${order.orderNumber} has been delivered. We hope you love it — thank you for choosing Xarvisrobo.`,
    "",
    `View your order: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("Your order has been delivered", bodyHtml), text };
}

/** Payment rejected — includes the admin's reason + a prompt to resubmit. */
export function paymentRejectedEmail(
  order: OrderEmailData,
  reason: string,
  orderUrl: string,
): EmailContent {
  const subject = `Action needed on order ${order.orderNumber}`;

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(
      `We couldn't verify your payment for order <strong style="color:#171717;">${order.orderNumber}</strong>:`,
    ) +
    `<p style="margin:0 0 12px;padding:12px 16px;background-color:#fef2f2;border-radius:8px;font-size:14px;line-height:1.6;color:#b91c1c;">${reason}</p>` +
    paragraph("Please check your payment details and submit them again.") +
    button(orderUrl, "Submit payment again");

  const text = [
    greeting(order.customerName),
    "",
    `We couldn't verify your payment for order ${order.orderNumber}:`,
    `  ${reason}`,
    "",
    "Please check your payment details and submit them again.",
    "",
    `Submit payment again: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("We couldn't verify your payment", bodyHtml), text };
}

/** Order cancelled — includes the reason. */
export function orderCancelledEmail(
  order: OrderEmailData,
  reason: string,
  orderUrl: string,
): EmailContent {
  const subject = `Order ${order.orderNumber} cancelled`;

  const bodyHtml =
    paragraph(greeting(order.customerName)) +
    paragraph(
      `Your order <strong style="color:#171717;">${order.orderNumber}</strong> has been cancelled.`,
    ) +
    `<p style="margin:0 0 12px;padding:12px 16px;background-color:#f5f5f5;border-radius:8px;font-size:14px;line-height:1.6;color:#525252;">Reason: ${reason}</p>` +
    paragraph("If you have any questions, just reply to this email — we're happy to help.") +
    button(orderUrl, "View your order");

  const text = [
    greeting(order.customerName),
    "",
    `Your order ${order.orderNumber} has been cancelled.`,
    `  Reason: ${reason}`,
    "",
    "If you have any questions, just reply to this email — we're happy to help.",
    "",
    `View your order: ${orderUrl}`,
    "",
    "— Xarvisrobo",
  ].join("\n");

  return { subject, html: shell("Your order was cancelled", bodyHtml), text };
}
