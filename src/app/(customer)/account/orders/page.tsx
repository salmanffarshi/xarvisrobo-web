import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, Package } from "lucide-react";

import { auth } from "@/auth";
import { formatBdt } from "@/lib/format";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { listForCustomer } from "@/services/order-service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";

export const metadata: Metadata = {
  title: "Your orders",
};

// Same tone → class map the detail page uses, kept in the site's restrained
// palette. Local to each page so the badge styling stays a UI concern.
const TONE_CLASSES: Record<ReturnType<typeof statusTone>, string> = {
  pending: "bg-amber-50 text-amber-700",
  progress: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  terminal: "bg-neutral-100 text-neutral-600",
};

// Compact date for the list (the detail page uses the long form).
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Dhaka",
});

function pageHref(page: number): string {
  return page <= 1 ? "/account/orders" : `/account/orders?page=${page}`;
}

// Customer order history (Phase D.1). Server component: the (customer) layout
// already guarantees a CUSTOMER session, and the service scopes to this user
// so only their own orders are ever listed.
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [session, { page: pageParam }] = await Promise.all([
    auth(),
    searchParams,
  ]);

  const requestedPage = Number(pageParam);
  const page = Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  const result = await listForCustomer(session!.user.id, { page });

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>

      {result.data.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-10 text-center">
          <Package
            strokeWidth={1.5}
            className="mx-auto size-8 text-neutral-400"
          />
          <p className="mt-4 font-medium text-neutral-900">
            You haven&apos;t placed any orders yet.
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            When you order a robot, it&apos;ll show up here.
          </p>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "default" }), "mt-6")}
          >
            Browse robots
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {result.data.map((order) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="flex items-center gap-4 rounded-2xl border border-neutral-200 p-4 transition-shadow hover:shadow-sm"
              >
                <div className="shrink-0 overflow-hidden rounded-xl">
                  <RobotPlaceholder
                    slug={order.firstItemSlug}
                    name={order.firstItemName}
                    size={56}
                    variant="card"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {dateFormatter.format(new Date(order.createdAt))} ·{" "}
                    {order.itemCount === 1
                      ? "1 item"
                      : `${order.itemCount} items`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 text-right">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-full px-3 py-1",
                      TONE_CLASSES[statusTone(order.status)],
                    )}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums text-neutral-900">
                    {formatBdt(order.total)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <Pagination className="mt-10">
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
    </section>
  );
}
