import type { Metadata } from "next";

import { auth } from "@/auth";
import { list as listAddresses } from "@/services/address-service";
import { AddAddressDialog } from "@/components/account/add-address-dialog";
import { AddressCard } from "@/components/account/address-card";

export const metadata: Metadata = {
  title: "Addresses",
};

// Addresses page (Phase B.3). Server component loads the user's addresses via
// the service (ADR-003 — the same scoped-by-userId query the API uses); all
// interactivity lives in the client card/dialog components.
export default async function AddressesPage() {
  const session = await auth();
  const addresses = await listAddresses(session!.user.id);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Addresses</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Your default address is preselected at checkout.
          </p>
        </div>
        <AddAddressDialog />
      </div>

      {addresses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-600">
            No saved addresses yet. Add one to speed up checkout.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      )}
    </section>
  );
}
