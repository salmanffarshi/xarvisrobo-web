import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, Paperclip } from "lucide-react";
import type { OrderStatus, PaymentMethod } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { requireStaffPage } from "@/lib/auth-guards";
import { formatBdt } from "@/lib/format";
import {
  ADMIN_ORDER_STATUS_LABELS,
  STATUS_TONE_CLASSES,
  statusTone,
} from "@/lib/order-status";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
} from "@/lib/payment-display";
import { cn } from "@/lib/utils";
import { adminListOrders } from "@/services/order-service";
import { OrderFilters } from "./order-filters";

// Admin order list (Phase E.2.1). Server component: the (dashboard) layout
// already guards staff; this reads the URL filters, calls the read service, and
// renders. Read-only — rows link to the detail page; no actions here.

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Dhaka",
});

/** Narrow a raw query string to a valid OrderStatus, else undefined. */
function parseStatus(value?: string): OrderStatus | undefined {
  return value && value in ADMIN_ORDER_STATUS_LABELS
    ? (value as OrderStatus)
    : undefined;
}

/** Narrow a raw query string to a valid PaymentMethod, else undefined. */
function parseMethod(value?: string): PaymentMethod | undefined {
  return value && value in PAYMENT_METHOD_LABELS
    ? (value as PaymentMethod)
    : undefined;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    paymentMethod?: string;
    search?: string;
    page?: string;
  }>;
}) {
  await requireStaffPage();
  const sp = await searchParams;

  const status = parseStatus(sp.status);
  const paymentMethod = parseMethod(sp.paymentMethod);
  const search = sp.search?.trim() || undefined;
  const requestedPage = Number(sp.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  const result = await adminListOrders({ status, paymentMethod, search, page });

  // Build a page link that preserves the active filters.
  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (search) params.set("search", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.total} {result.total === 1 ? "order" : "orders"}
          {(status || paymentMethod || search) && " matching filters"}
        </p>
      </header>

      <div className="mt-6">
        <OrderFilters filters={{ status, paymentMethod, search }} />
      </div>

      {result.data.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">
            No orders match these filters.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((order) => (
                <tr key={order.orderNumber} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium tabular-nums whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">
                      {order.customerName}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {order.customerEmail}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-transparent whitespace-nowrap",
                        STATUS_TONE_CLASSES[statusTone(order.status)],
                      )}
                    >
                      {ADMIN_ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border-transparent",
                          PAYMENT_STATUS_CLASSES[order.paymentStatus],
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </Badge>
                      {order.hasScreenshot && (
                        <Paperclip
                          className="text-muted-foreground size-3.5"
                          aria-label="Payment screenshot submitted"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatBdt(order.total)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {dateFormatter.format(new Date(order.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            {result.page > 1 && (
              <PaginationItem>
                <Link
                  href={pageHref(result.page - 1)}
                  aria-label="Go to previous page"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 px-2.5",
                  )}
                >
                  <ChevronLeftIcon className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </Link>
              </PaginationItem>
            )}
            {Array.from({ length: result.totalPages }, (_, i) => i + 1).map(
              (p) => (
                <PaginationItem key={p}>
                  <Link
                    href={pageHref(p)}
                    aria-current={p === result.page ? "page" : undefined}
                    className={buttonVariants({
                      variant: p === result.page ? "outline" : "ghost",
                      size: "icon",
                    })}
                  >
                    {p}
                  </Link>
                </PaginationItem>
              ),
            )}
            {result.page < result.totalPages && (
              <PaginationItem>
                <Link
                  href={pageHref(result.page + 1)}
                  aria-label="Go to next page"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 px-2.5",
                  )}
                >
                  <span className="hidden sm:block">Next</span>
                  <ChevronRightIcon className="size-4" />
                </Link>
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
