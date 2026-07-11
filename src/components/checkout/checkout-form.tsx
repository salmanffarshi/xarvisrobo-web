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
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { computeDeliveryCharge } from "@/lib/delivery";
import { formatBdt } from "@/lib/format";
import { subtractMoney, sumMoney } from "@/lib/money";
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
  codCharges,
}: {
  addresses: AddressData[];
  profilePhone: string | null;
  // The two COD charge NUMBERS from the Settings row, so this live display uses
  // exactly what the server will compute at placement (ADR-016).
  codCharges: { insideDhaka: number; outsideDhaka: number };
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

  // Coupon (Phase E.5) — display only. The server re-validates + recomputes at
  // placement (ADR-005); we send only the applied code, never the discount.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

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
  const deliveryCharge = computeDeliveryCharge(
    paymentMethod,
    deliveryZone,
    codCharges,
  );
  // Clamp the applied discount to the current subtotal for display — the cart
  // may have changed since Apply. Placement recomputes authoritatively (ADR-005).
  const discount = !appliedCoupon
    ? "0.00"
    : Number(appliedCoupon.discount) <= Number(subtotal)
      ? appliedCoupon.discount
      : subtotal;
  const total = sumMoney([subtractMoney(subtotal, discount), deliveryCharge]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/v1/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body:
        | { valid: true; code: string; discount: string }
        | { valid: false; message: string }
        | null = await res.json().catch(() => null);

      if (body && body.valid) {
        setAppliedCoupon({ code: body.code, discount: body.discount });
        setCouponInput("");
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(body?.message ?? "Could not apply that coupon.");
      }
    } catch {
      setCouponError("Network error. Please try again.");
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

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
          // Only the code — the server re-validates + recomputes (ADR-005).
          couponCode: appliedCoupon?.code,
        }),
      });
      const body:
        | { orderNumber?: string; error?: { code?: string; message?: string } }
        | null = await res.json().catch(() => null);

      if (res.status === 201 && body?.orderNumber) {
        // Keep the button disabled while navigating; refresh so the header
        // cart badge reflects the now-empty server cart.
        router.push(`/account/orders/${body.orderNumber}?placed=1`);
        router.refresh();
        return;
      }

      // Coupon became invalid between Apply and placement (e.g. a usage cap was
      // hit by another order) — drop it so the summary updates, and surface why.
      if (body?.error?.code === "COUPON_INVALID") {
        setAppliedCoupon(null);
        setCouponError(body.error.message ?? "That coupon is no longer valid.");
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
                            ? `+ ${formatBdt(computeDeliveryCharge("COD", deliveryZone, codCharges))} delivery charge`
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

            {/* Coupon (Phase E.5) */}
            <div className="mt-4 border-t border-neutral-200 pt-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-emerald-800">
                    {appliedCoupon.code} applied
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="flex shrink-0 items-center gap-1 text-emerald-700 transition-colors hover:text-emerald-900"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-neutral-600">Have a coupon?</span>
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="Enter code"
                      className="rounded-xl uppercase"
                      autoCapitalize="characters"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 rounded-xl"
                      onClick={applyCoupon}
                      disabled={applyingCoupon || !couponInput.trim()}
                    >
                      {applyingCoupon && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Apply
                    </Button>
                  </div>
                </div>
              )}
              {couponError && (
                <p className="mt-2 text-xs text-red-600">{couponError}</p>
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="tabular-nums text-neutral-900">
                  {formatBdt(subtotal)}
                </span>
              </div>
              {appliedCoupon && (
                <div className="flex items-baseline justify-between text-emerald-700">
                  <span>Discount ({appliedCoupon.code})</span>
                  <span className="tabular-nums">−{formatBdt(discount)}</span>
                </div>
              )}
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
