import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isCustomer } from "@/lib/permissions";
import { getProfile } from "@/services/account-service";
import { list as listAddresses } from "@/services/address-service";
import { getCart } from "@/services/cart-service";
import { getSettings } from "@/services/settings-service";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Checkout",
};

// Checkout (Phase C.2). Server component shell: enforces the customer-session
// gate and loads cart + addresses + profile through the services (ADR-003).
// All interactivity (address choice, live COD summary, placement) lives in
// the CheckoutForm client component.
export default async function CheckoutPage() {
  const session = await auth();
  if (!session?.user || !isCustomer(session.user.role)) {
    // Guests come back here after signing in (guest cart merges on login).
    redirect("/login?callbackUrl=/checkout");
  }
  const userId = session.user.id;

  const [cart, addresses, profile, settings] = await Promise.all([
    getCart(userId),
    listAddresses(userId),
    getProfile(userId),
    getSettings(),
  ]);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Checkout
        </h1>
        <div className="mt-16 flex flex-col items-center gap-5 text-center">
          <p className="text-neutral-600">Your cart is empty.</p>
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/products">Browse robots</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        Checkout
      </h1>
      <CheckoutForm
        addresses={addresses.map((address) => ({
          id: address.id,
          label: address.label,
          recipientName: address.recipientName,
          phone: address.phone,
          streetAddress: address.streetAddress,
          city: address.city,
          district: address.district,
          postalCode: address.postalCode,
          isDefault: address.isDefault,
        }))}
        profilePhone={profile.phone}
        codCharges={{
          insideDhaka: settings.codInsideDhaka,
          outsideDhaka: settings.codOutsideDhaka,
        }}
      />
    </div>
  );
}
