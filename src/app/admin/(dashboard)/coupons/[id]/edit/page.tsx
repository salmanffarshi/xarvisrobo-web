import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { formatBdt } from "@/lib/format";
import { requireStaffPage } from "@/lib/auth-guards";
import {
  CouponNotFoundError,
  get,
  type AdminCouponDetail,
} from "@/services/coupon-admin-service";
import { CouponForm } from "../../coupon-form";
import { CouponDangerZone } from "../../coupon-danger-zone";

export const metadata: Metadata = { title: "Edit coupon" };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPage();
  const { id } = await params;

  let coupon: AdminCouponDetail;
  try {
    coupon = await get(id);
  } catch (error) {
    if (error instanceof CouponNotFoundError) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/admin/coupons"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Coupons
      </Link>
      <h1 className="mt-3 font-mono text-2xl font-semibold tracking-tight">
        {coupon.code}
      </h1>

      <CouponForm
        initial={{
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderAmount: coupon.minOrderAmount,
          totalUsageLimit: coupon.totalUsageLimit,
          perCustomerLimit: coupon.perCustomerLimit,
          validFrom: coupon.validFrom,
          validUntil: coupon.validUntil,
          isActive: coupon.isActive,
        }}
      />

      {/* Redemptions */}
      <section className="mt-10">
        <h2 className="font-medium tracking-tight">
          Redemptions ({coupon.redemptionCount})
        </h2>
        {coupon.redemptions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            This coupon has not been redeemed yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 text-right font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupon.redemptions.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{r.customerName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${r.orderNumber}`}
                        className="font-mono underline-offset-4 hover:underline"
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      −{formatBdt(r.discountAmount)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {dateFormatter.format(new Date(r.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CouponDangerZone
        couponId={coupon.id}
        isActive={coupon.isActive}
        hasRedemptions={coupon.redemptionCount > 0}
      />
    </div>
  );
}
