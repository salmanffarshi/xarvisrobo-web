import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { requireStaffPage } from "@/lib/auth-guards";
import { formatBdt } from "@/lib/format";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { getDashboardStats } from "@/services/admin-service";

// Admin dashboard home (Phase E.1; card links wired in E.2.1). Live aggregate
// stats + the 10 newest orders. Still read-only — the needs-attention cards and
// recent-order rows now link into the E.2.1 order views, but nothing here
// mutates. The layout already guards this route; requireStaffPage here is
// defense-in-depth and gives us the signed-in name for the greeting.

// Same tone → class map the customer order pages use, kept in the site's
// restrained palette.
const TONE_CLASSES: Record<ReturnType<typeof statusTone>, string> = {
  pending: "bg-amber-50 text-amber-700",
  progress: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  terminal: "bg-neutral-100 text-neutral-600",
};

function StatCard({
  label,
  value,
  attention = false,
  href,
}: {
  label: string;
  value: string | number;
  attention?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <p
        className={cn(
          "text-sm",
          attention ? "text-amber-700" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          attention && "text-amber-900",
        )}
      >
        {value}
      </p>
    </>
  );

  const className = cn(
    "block rounded-2xl border p-5",
    attention ? "border-amber-200 bg-amber-50" : "bg-card",
  );

  // A card with a destination becomes a link (the E.2.1 order views now exist).
  if (href) {
    return (
      <Link href={href} className={cn(className, "transition-shadow hover:shadow-sm")}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminDashboardPage() {
  const session = await requireStaffPage();
  const stats = await getDashboardStats();
  const { needsAction, inProgress, totals, recentOrders } = stats;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome back, {session.user.name}.
        </p>
      </header>

      {/* Needs attention — the actionable queues, most prominent. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">
          Needs attention
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Pending payment verifications"
            value={needsAction.pendingPaymentVerifications}
            attention={needsAction.pendingPaymentVerifications > 0}
            href="/admin/orders?status=WAITING_FOR_PAYMENT_VERIFICATION"
          />
          <StatCard
            label="Pending COD confirmations"
            value={needsAction.pendingCodConfirmations}
            attention={needsAction.pendingCodConfirmations > 0}
            href="/admin/orders?status=WAITING_FOR_ORDER_CONFIRMATION"
          />
        </div>
      </section>

      {/* In progress — orders moving through the pipeline. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">In progress</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Awaiting payment" value={inProgress.awaitingPayment} />
          <StatCard label="Ready to produce" value={inProgress.readyToProduce} />
          <StatCard label="In production" value={inProgress.inProduction} />
          <StatCard label="Shipped" value={inProgress.shipped} />
        </div>
      </section>

      {/* Totals — the at-a-glance business figures. Recognized revenue is the
          DERIVED figure (payment received, not returned/cancelled); returns are
          surfaced beside it as their own count + reversed value (Phase F). */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Totals</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Total orders" value={totals.totalOrders} />
          <StatCard label="Delivered" value={totals.deliveredOrders} />
          <StatCard label="Returned orders" value={totals.returnedOrders} />
          <StatCard label="Customers" value={totals.totalCustomers} />
          <StatCard label="Recognized revenue" value={formatBdt(totals.revenue)} />
          <StatCard label="Returned value" value={formatBdt(totals.returnedValue)} />
        </div>
      </section>

      {/* Recent orders — 10 newest, read-only (E.2 makes these clickable). */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Recent orders</h2>
        {recentOrders.length === 0 ? (
          <div className="mt-3 rounded-2xl border bg-card p-10 text-center">
            <p className="text-muted-foreground text-sm">No orders yet.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.orderNumber} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium tabular-nums">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {order.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border-transparent",
                          TONE_CLASSES[statusTone(order.status)],
                        )}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatBdt(order.total)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
