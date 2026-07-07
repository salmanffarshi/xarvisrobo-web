"use client";

// Single-page checkout (Phase C.2): shipping address → contact phone →
// delivery notes → payment method, with a sticky summary whose delivery
// charge updates live when COD is selected.
//
// One component owns both columns because the summary must react to the
// payment-method radio. Line items and subtotal come from useCart() — display
// only; the server recomputes every total at placement (ADR-005), which is
// why the POST body carries no prices.
//
// There is deliberately NO <form> element here: the reused B.3 AddressForm
// renders its own <form>, and HTML forbids nesting forms. The Place-order
// button invokes react-hook-form's handleSubmit directly instead.
//
// Double-submit safety: one idempotency key is generated per page mount and
// reused on every retry, so the server dedupes even if the disabled-button
// guard is somehow bypassed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { computeDeliveryCharge } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";
import { sumMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  placeOrderSchema,
  type PlaceOrderInput,
} from "@/lib/validations/order";
import {
  AddressForm,
  type AddressData,
} from "@/components/account/address-form";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const PAYMENT_OPTIONS: {
  value: PlaceOrderInput["paymentMethod"];
  label: string;
  descriptor: string;
}[] = [
  {
    value: "BKASH",
    label: "bKash",
    descriptor: "Send money to our bKash number — details after you order.",
  },
  {
    value: "NAGAD",
    label: "Nagad",
    descriptor: "Send money to our Nagad number — details after you order.",
  },
  {
    value: "BANK",
    label: "Bank transfer",
    descriptor: "Transfer to our bank account — details after you order.",
  },
  {
    value: "COD",
    label: "Cash on delivery",
    descriptor: "Pay in cash when your robot arrives.",
  },
];

const DELIVERY_ZONE_OPTIONS: {
  value: PlaceOrderInput["deliveryZone"];
  label: string;
  descriptor: string;
}[] = [
  {
    value: "INSIDE_DHAKA",
    label: "Inside Dhaka",
    descriptor: "Delivery within Dhaka city.",
  },
  {
    value: "OUTSIDE_DHAKA",
    label: "Outside Dhaka",
    descriptor: "Anywhere else in Bangladesh.",
  },
];

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 font-medium tracking-tight text-neutral-900">
      <span className="flex size-6 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
        {step}
      </span>
      {title}
    </h2>
  );
}

export function CheckoutForm({
  addresses: initialAddresses,
  profilePhone,
}: {
  addresses: AddressData[];
  profilePhone: string | null;
}) {
  const router = useRouter();
  const { items, subtotal } = useCart();

  const [addresses, setAddresses] = useState(initialAddresses);
  const [showAddressForm, setShowAddressForm] = useState(
    initialAddresses.length === 0,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ONE key per page mount, reused across retries — the server's idempotency
  // guarantee hinges on retries carrying the same key.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const defaultAddress =
    initialAddresses.find((address) => address.isDefault) ??
    initialAddresses[0];

  const form = useForm<PlaceOrderInput>({
    resolver: zodResolver(placeOrderSchema),
    defaultValues: {
      addressId: defaultAddress?.id ?? "",
      contactPhone: defaultAddress?.phone ?? profilePhone ?? "",
      deliveryNotes: "",
      paymentMethod: "BKASH",
      deliveryZone: "INSIDE_DHAKA",
    },
  });

  const selectedAddressId = form.watch("addressId");
  const paymentMethod = form.watch("paymentMethod");
  const deliveryZone = form.watch("deliveryZone");

  // Same helper the server uses at placement (ADR-016), so this displayed
  // charge always matches what gets stored. Recomputes whenever the method or
  // the zone radio changes.
  const deliveryCharge = computeDeliveryCharge(paymentMethod, deliveryZone);
  const total = sumMoney([subtotal, deliveryCharge]);

  function selectAddress(address: AddressData) {
    form.setValue("addressId", address.id, { shouldValidate: true });
    // Follow the address's phone unless the customer typed their own.
    if (!form.getFieldState("contactPhone").isDirty) {
      form.setValue("contactPhone", address.phone);
    }
  }

  /** AddressForm saved a new address — reload the list and select it. */
  async function handleAddressAdded() {
    const res = await fetch("/api/v1/me/addresses");
    const body: { addresses?: AddressData[] } | null = await res
      .json()
      .catch(() => null);
    if (!res.ok || !body?.addresses) return;

    const knownIds = new Set(addresses.map((address) => address.id));
    const added = body.addresses.find((address) => !knownIds.has(address.id));
    setAddresses(body.addresses);
    setShowAddressForm(false);
    if (added) selectAddress(added);
  }

  async function onSubmit(values: PlaceOrderInput) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        // No prices in the body — ever (ADR-005). The zone is a choice, not a
        // price; the server computes the authoritative charge from it.
        body: JSON.stringify({
          addressId: values.addressId,
          contactPhone: values.contactPhone,
          deliveryNotes: values.deliveryNotes || undefined,
          paymentMethod: values.paymentMethod,
          deliveryZone: values.deliveryZone,
        }),
      });
      const body: { orderNumber?: string; error?: { message?: string } } | null =
        await res.json().catch(() => null);

      if (res.status === 201 && body?.orderNumber) {
        // Keep the button disabled while navigating; refresh so the header
        // cart badge reflects the now-empty server cart.
        router.push(`/account/orders/${body.orderNumber}?placed=1`);
        router.refresh();
        return;
      }

      toast.error(
        body?.error?.message ?? "Could not place your order. Please try again.",
      );
      setIsSubmitting(false);
    } catch {
      toast.error("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  function onInvalid() {
    if (form.formState.errors.addressId) {
      toast.error("Please select a shipping address.");
    } else {
      toast.error("Please fix the highlighted fields.");
    }
  }

  return (
    <Form {...form}>
      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        {/* ——— Left column: the form sections ——— */}
        <div className="space-y-10 lg:col-span-2">
          {/* Section 1 — shipping address */}
          <section>
            <SectionHeading step={1} title="Shipping address" />
            {addresses.length > 0 && (
              <div className="mt-4 grid gap-3">
                {addresses.map((address) => {
                  const selected = address.id === selectedAddressId;
                  return (
                    <label
                      key={address.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                        selected
                          ? "border-blue-600 ring-1 ring-blue-600"
                          : "border-neutral-200 hover:border-neutral-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping-address"
                        className="sr-only"
                        checked={selected}
                        onChange={() => selectAddress(address)}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-blue-600" : "border-neutral-300",
                        )}
                      >
                        {selected && (
                          <span className="size-2 rounded-full bg-blue-600" />
                        )}
                      </span>
                      <span className="min-w-0 text-sm">
                        <span className="font-medium text-neutral-900">
                          {address.label}
                        </span>
                        {address.isDefault && (
                          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            Default
                          </span>
                        )}
                        <span className="mt-1 block text-neutral-600">
                          {address.recipientName} · {address.phone}
                        </span>
                        <span className="block text-neutral-600">
                          {address.streetAddress}, {address.city},{" "}
                          {address.district} {address.postalCode}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {showAddressForm ? (
              <div className="mt-4 rounded-2xl border border-neutral-200 p-5">
                <p className="mb-4 text-sm font-medium text-neutral-900">
                  {addresses.length === 0
                    ? "Add a shipping address to continue."
                    : "New address"}
                </p>
                <AddressForm onSuccess={handleAddressAdded} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="mt-4 flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
              >
                <Plus className="size-4" strokeWidth={1.5} />
                Add a new address
              </button>
            )}
          </section>

          {/* Section 2 — contact phone */}
          <section>
            <SectionHeading step={2} title="Contact phone" />
            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem className="mt-4 max-w-sm">
                  <FormLabel className="sr-only">Contact phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      className="rounded-xl"
                      placeholder="01712345678"
                      autoComplete="tel"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-neutral-500">
                    We&apos;ll call this number about your delivery.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Section 3 — delivery notes */}
          <section>
            <SectionHeading step={3} title="Delivery notes (optional)" />
            <FormField
              control={form.control}
              name="deliveryNotes"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel className="sr-only">Delivery notes</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-24 rounded-xl"
                      placeholder="Landmarks, preferred delivery time, gate instructions…"
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* Section 4 — payment method */}
          <section>
            <SectionHeading step={4} title="Payment method" />
            <div className="mt-4 grid gap-3">
              {PAYMENT_OPTIONS.map((option) => {
                const selected = option.value === paymentMethod;
                const isCod = option.value === "COD";
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                      selected
                        ? "border-blue-600 ring-1 ring-blue-600"
                        : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        form.setValue("paymentMethod", option.value)
                      }
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-blue-600" : "border-neutral-300",
                      )}
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-blue-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-neutral-900">
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            isCod ? "text-neutral-600" : "text-emerald-700",
                          )}
                        >
                          {isCod
                            ? `+ ${formatBdt(computeDeliveryCharge("COD", deliveryZone))} delivery charge`
                            : "Free delivery"}
                        </span>
                      </span>
                      <span className="mt-1 block text-neutral-600">
                        {option.descriptor}
                      </span>
                      {isCod && (
                        <span className="mt-1 block text-neutral-500">
                          COD orders are confirmed by phone before we begin
                          building.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Section 5 — delivery zone (always shown; drives the COD charge) */}
          <section>
            <SectionHeading step={5} title="Delivery zone" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {DELIVERY_ZONE_OPTIONS.map((option) => {
                const selected = option.value === deliveryZone;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
                      selected
                        ? "border-blue-600 ring-1 ring-blue-600"
                        : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="delivery-zone"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        form.setValue("deliveryZone", option.value)
                      }
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-blue-600" : "border-neutral-300",
                      )}
                    >
                      {selected && (
                        <span className="size-2 rounded-full bg-blue-600" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-neutral-900">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-neutral-600">
                        {option.descriptor}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* ——— Right column: sticky order summary ——— */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-neutral-50 p-6 lg:sticky lg:top-24">
            <h2 className="font-medium tracking-tight text-neutral-900">
              Order summary
            </h2>

            <ul className="mt-4 space-y-2 text-sm">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-neutral-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-900">
                    {formatBdt(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="tabular-nums text-neutral-900">
                  {formatBdt(subtotal)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-600">Delivery</span>
                <span className="tabular-nums text-neutral-900">
                  {deliveryCharge === "0.00"
                    ? "Free"
                    : formatBdt(deliveryCharge)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3 font-medium">
                <span className="text-neutral-900">Total</span>
                <span className="tabular-nums text-neutral-900">
                  {formatBdt(total)}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-6 w-full rounded-full"
              disabled={isSubmitting}
              onClick={form.handleSubmit(onSubmit, onInvalid)}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Place order
            </Button>
            <p className="mt-3 text-center text-xs text-neutral-500">
              Totals are confirmed on your order — prices come from our
              catalog, never your browser.
            </p>
          </div>
        </div>
      </div>
    </Form>
  );
}
