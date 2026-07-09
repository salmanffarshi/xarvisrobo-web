// Gated order action block (Phase D.2). The ONLY place the order-detail page
// renders a payment/action prompt. It shows content for exactly three
// actionable states and renders NOTHING for every other status — so a
// cancelled, delivered, verified, or in-production order shows no "how to pay"
// (fixes the D.1 gap where instructions showed regardless of status).
//
// Actionable states:
//   Prepaid + WAITING_FOR_PAYMENT              → instructions + proof form
//   Prepaid + WAITING_FOR_PAYMENT_VERIFICATION → "submitted" read-back + WhatsApp
//   COD + WAITING_FOR_ORDER_CONFIRMATION       → phone-confirm note + WhatsApp
//
// Server component: it builds the WhatsApp links (message templates) and hands
// the proof form only what it needs. WhatsApp links change no order state.

import { MessageCircle } from "lucide-react";

import {
  paymentGeneralNote,
  paymentReceivingDetails,
  type PrepaidMethod,
} from "@/config/payment";
import { DELIVERY_ZONE_LABELS } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";
import {
  buildWhatsAppUrl,
  codConfirmMessage,
  prepaidProofMessage,
} from "@/lib/whatsapp";
import type { OrderDetailView } from "@/types/order";
import { PaymentProofForm } from "@/components/order/payment-proof-form";

/** Card shell shared by every actionable state. */
function ActionCard({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-6">
      <h2 className="text-sm font-medium text-neutral-500">{heading}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** A WhatsApp button (opens click-to-chat in a new tab). */
function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      <MessageCircle className="size-4" />
      {label}
    </a>
  );
}

/** Receiving-account details for a prepaid method (bKash / Nagad). */
function PrepaidInstructions({ order }: { order: OrderDetailView }) {
  const method = order.paymentMethod as PrepaidMethod;
  const details = paymentReceivingDetails[method];

  return (
    <div className="space-y-3 text-sm text-neutral-600">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[auto_1fr]">
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
        <dt className="text-neutral-500">Amount to send</dt>
        <dd className="font-medium tabular-nums text-neutral-900">
          {formatBdt(order.total)}
        </dd>
        <dt className="text-neutral-500">Reference</dt>
        <dd className="font-medium text-neutral-900">{order.orderNumber}</dd>
      </dl>
      {details.instructions && <p>{details.instructions}</p>}
      <p>{paymentGeneralNote}</p>
    </div>
  );
}

export function OrderActionBlock({ order }: { order: OrderDetailView }) {
  const { paymentMethod, status } = order;
  const isPrepaid = paymentMethod !== "COD";

  // 1. Prepaid, awaiting payment → instructions + proof form.
  if (isPrepaid && status === "WAITING_FOR_PAYMENT") {
    return (
      <ActionCard heading="How to pay">
        <div className="space-y-6">
          <PrepaidInstructions order={order} />
          <div className="border-t border-neutral-100 pt-6">
            <p className="mb-4 text-sm text-neutral-600">
              Once you&apos;ve sent the payment, enter the details below so we
              can verify it.
            </p>
            <PaymentProofForm
              orderNumber={order.orderNumber}
              defaultAmount={order.total}
              whatsappUrl={buildWhatsAppUrl(prepaidProofMessage(order))}
            />
          </div>
        </div>
      </ActionCard>
    );
  }

  // 2. Prepaid, proof submitted → calm read-back + WhatsApp fallback.
  if (isPrepaid && status === "WAITING_FOR_PAYMENT_VERIFICATION") {
    const { payment } = order;
    return (
      <ActionCard heading="Payment submitted">
        <div className="space-y-5 text-sm text-neutral-600">
          <p>
            We&apos;ve received your payment details and are verifying them.
            We&apos;ll update your order once it&apos;s confirmed.
          </p>
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            <dt className="text-neutral-500">Transaction ID</dt>
            <dd className="font-medium text-neutral-900">
              {payment.transactionId ?? "—"}
            </dd>
            <dt className="text-neutral-500">Sender number</dt>
            <dd className="font-medium tabular-nums text-neutral-900">
              {payment.senderNumber ?? "—"}
            </dd>
            <dt className="text-neutral-500">Amount paid</dt>
            <dd className="font-medium tabular-nums text-neutral-900">
              {payment.paidAmount ? formatBdt(payment.paidAmount) : "—"}
            </dd>
          </dl>
          {payment.screenshotUrl && (
            <a
              href={payment.screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payment.screenshotUrl}
                alt="Your payment screenshot"
                className="size-24 rounded-lg border border-neutral-200 object-cover"
              />
            </a>
          )}
          <div className="pt-1">
            <WhatsAppButton
              href={buildWhatsAppUrl(prepaidProofMessage(order))}
              label="Send your screenshot on WhatsApp"
            />
          </div>
        </div>
      </ActionCard>
    );
  }

  // 3. COD, awaiting confirmation → phone-confirm note + WhatsApp.
  if (paymentMethod === "COD" && status === "WAITING_FOR_ORDER_CONFIRMATION") {
    return (
      <ActionCard heading="Cash on delivery">
        <div className="space-y-5 text-sm text-neutral-600">
          <p>
            Our team will call you at{" "}
            <span className="font-medium text-neutral-900">
              {order.contactPhone}
            </span>{" "}
            to confirm before we begin. Delivery charge{" "}
            {formatBdt(order.deliveryCharge)} (
            {DELIVERY_ZONE_LABELS[order.deliveryZone]}) is payable on delivery.
          </p>
          <WhatsAppButton
            href={buildWhatsAppUrl(codConfirmMessage(order))}
            label="Confirm on WhatsApp"
          />
        </div>
      </ActionCard>
    );
  }

  // 4. Every other status → nothing to do here.
  return null;
}
