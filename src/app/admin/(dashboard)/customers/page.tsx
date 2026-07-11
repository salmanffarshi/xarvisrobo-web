import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { requireStaffPage } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";
import { list } from "@/services/customer-admin-service";
import { CustomerSearch } from "./customer-search";

export const metadata: Metadata = { title: "Customers" };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Dhaka",
});

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireStaffPage();
  const sp = await searchParams;

  const search = sp.search?.trim() || undefined;
  const requestedPage = Number(sp.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  const result = await list({ search, page });

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.total} {result.total === 1 ? "customer" : "customers"}
          {search && " matching your search"}
        </p>
      </header>

      <div className="mt-6">
        <CustomerSearch search={search} />
      </div>

      {result.data.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">No customers found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.data.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{c.email}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.orderCount}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {dateFormatter.format(new Date(c.createdAt))}
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
                      {c.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <Link
                href={pageHref(page - 1)}
                aria-disabled={page <= 1}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  page <= 1 && "pointer-events-none opacity-50",
                )}
              >
                <ChevronLeftIcon className="size-4" />
              </Link>
            </PaginationItem>
            <PaginationItem>
              <span className="text-muted-foreground px-3 text-sm">
                Page {page} of {result.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page >= result.totalPages}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  page >= result.totalPages && "pointer-events-none opacity-50",
                )}
              >
                <ChevronRightIcon className="size-4" />
              </Link>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
