// WhatsApp deep-link helper + message templates (Phase D.2).
//
// wa.me/<number>?text=<message> opens WhatsApp with a pre-filled message to the
// business number (config). It CANNOT attach a file — the customer taps the
// paperclip and adds their screenshot themselves — so the prepaid template asks
// them to do exactly that. Neither link changes any order state; they are pure
// convenience handoffs (COD confirmation is a Phase E admin action).

import { WHATSAPP_NUMBER } from "@/config/payment";
import { formatBdt } from "@/lib/format";
import { DELIVERY_ZONE_LABELS } from "@/lib/delivery";
import type { OrderDetailView } from "@/types/order";

/** Human-friendly names for the prepaid methods in customer messages. */
const METHOD_LABELS: Record<"BKASH" | "NAGAD" | "BANK", string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  BANK: "Bank transfer",
};

/** Build a WhatsApp click-to-chat URL to the business number. */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Prepaid: the customer says they've paid and will attach the screenshot. */
export function prepaidProofMessage(order: OrderDetailView): string {
  const method =
    METHOD_LABELS[order.paymentMethod as "BKASH" | "NAGAD" | "BANK"] ??
    order.paymentMethod;
  return (
    `Hello Xarvisrobo, I've paid for order ${order.orderNumber}. ` +
    `Amount: ${formatBdt(order.total)}, Method: ${method}. ` +
    `I'm attaching my payment screenshot.`
  );
}

/** COD: the customer confirms they want the cash-on-delivery order to proceed. */
export function codConfirmMessage(order: OrderDetailView): string {
  const zone = DELIVERY_ZONE_LABELS[order.deliveryZone];
  return (
    `Hello Xarvisrobo, I'd like to confirm my Cash on Delivery order ` +
    `${order.orderNumber} for ${formatBdt(order.total)} (${zone} delivery). ` +
    `Please proceed.`
  );
}
