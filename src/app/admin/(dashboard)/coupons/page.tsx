import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatBdt } from "@/lib/format";
import { requireStaffPage } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";
import { list, type AdminCouponSummary } from "@/services/coupon-admin-service";

export const metadata: Metadata = { title: "Coupons" };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Dhaka",
});

/** "10%" for percentage, "৳200" for fixed. */
function formatDiscount(c: AdminCouponSummary): string {
  return c.discountType === "PERCENTAGE"
    ? `${parseFloat(c.discountValue)}%`
    : formatBdt(c.discountValue);
}

function formatValidity(c: AdminCouponSummary): string {
  const from = c.validFrom ? dateFormatter.format(new Date(c.validFrom)) : null;
  const until = c.validUntil ? dateFormatter.format(new Date(c.validUntil)) : null;
  if (!from && !until) return "Always";
  if (from && until) return `${from} – ${until}`;
  if (from) return `From ${from}`;
  return `Until ${until}`;
}

export default async function AdminCouponsPage() {
  await requireStaffPage();
  const coupons = await list();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {coupons.length} {coupons.length === 1 ? "coupon" : "coupons"}
          </p>
        </div>
        <Link href="/admin/coupons/new" className={cn(buttonVariants())}>
          <Plus className="mr-2 size-4" />
          Add coupon
        </Link>
      </header>

      {coupons.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">
            No coupons yet. Create one to offer a discount at checkout.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Min order</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Validity</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/coupons/${c.id}/edit`}
                      className="font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDiscount(c)}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {c.minOrderAmount === "0.00" ? "—" : formatBdt(c.minOrderAmount)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.redemptionCount} / {c.totalUsageLimit ?? "∞"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatValidity(c)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        c.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500",
                      )}
                    >
                      {c.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
