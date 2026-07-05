import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { getProfile } from "@/services/account-service";
import { list as listAddresses } from "@/services/address-service";

export const metadata: Metadata = {
  title: "My account",
};

// Account overview (Phase B.3). Server component: reads the session (the
// (customer) layout already guarantees a CUSTOMER session exists) and loads
// the profile + address count through the services (ADR-003).
export default async function AccountOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [profile, addresses] = await Promise.all([
    getProfile(userId),
    listAddresses(userId),
  ]);

  const firstName = profile.name.split(" ")[0];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {firstName}.
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Manage your profile, addresses, and security from here.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-sm font-medium text-neutral-500">Profile</h2>
          <p className="mt-3 font-medium">{profile.name}</p>
          <p className="mt-1 text-sm text-neutral-600">{profile.email}</p>
          <Link
            href="/account/profile"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Edit profile
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-sm font-medium text-neutral-500">Addresses</h2>
          <p className="mt-3 font-medium">
            {addresses.length === 0
              ? "No saved addresses"
              : `${addresses.length} saved ${addresses.length === 1 ? "address" : "addresses"}`}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Saved addresses speed up checkout.
          </p>
          <Link
            href="/account/addresses"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Manage addresses
          </Link>
        </div>

        {/* Static placeholder — real order history arrives with checkout in a
            later phase (Phase D). */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:col-span-2">
          <h2 className="text-sm font-medium text-neutral-500">Orders</h2>
          <p className="mt-3 text-sm text-neutral-600">
            No orders yet — your orders will appear here. Order history arrives
            in a later phase.
          </p>
        </div>
      </div>
    </section>
  );
}
