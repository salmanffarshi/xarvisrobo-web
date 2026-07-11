import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth-guards";
import { formatBdt } from "@/lib/format";
import { ADMIN_ORDER_STATUS_LABELS } from "@/lib/order-status";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-display";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { get } from "@/services/customer-admin-service";
import { ActiveToggle } from "../active-toggle";
import { NotesPanel } from "../notes-panel";

export const metadata: Metadata = { title: "Customer" };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Dhaka",
});

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffPage();
  const { id } = await params;

  const customer = await get(id);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/admin/customers"
        className="text-muted-foreground mb-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Customers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {customer.name}
            <Badge
              variant="secondary"
              className={cn(
                customer.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-neutral-100 text-neutral-500",
              )}
            >
              {customer.isActive ? "Active" : "Deactivated"}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ""} · Joined{" "}
            {dateFormatter.format(new Date(customer.createdAt))}
          </p>
        </div>
        <ActiveToggle customerId={customer.id} isActive={customer.isActive} />
      </div>

      <div className="mt-8 space-y-6">
        {/* Orders */}
        <div className="rounded-2xl border p-6">
          <h2 className="text-muted-foreground text-sm font-medium">
            Orders ({customer.orders.length})
          </h2>
          {customer.orders.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">No orders yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Order</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Method</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customer.orders.map((o) => (
                    <tr key={o.orderNumber}>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="text-muted-foreground py-2 pr-4">
                        {dateFormatter.format(new Date(o.createdAt))}
                      </td>
                      <td className="py-2 pr-4">{PAYMENT_METHOD_LABELS[o.paymentMethod]}</td>
                      <td className="py-2 pr-4">{ADMIN_ORDER_STATUS_LABELS[o.status]}</td>
                      <td className="py-2 text-right tabular-nums">{formatBdt(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Internal notes */}
        <NotesPanel
          customerId={customer.id}
          notes={customer.notes}
          currentUserId={session.user.id}
          canDeleteAll={isAdmin(session.user.role)}
        />
      </div>
    </div>
  );
}
