import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireStaffPage } from "@/lib/auth-guards";
import { CouponForm } from "../coupon-form";

export const metadata: Metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  await requireStaffPage();

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/admin/coupons"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Coupons
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New coupon</h1>
      <CouponForm />
    </div>
  );
}
