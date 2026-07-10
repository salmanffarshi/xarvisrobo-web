"use client";

// Admin order-list filter bar. Same URL-as-state pattern as the B.2 catalog:
// every change builds the next filter set, stringifies it, and pushes to the
// router — the /admin/orders server component then re-renders with fresh data.
// No local results state; only the search box is locally controlled (debounced).

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus, PaymentMethod } from "@prisma/client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_ORDER_STATUS_LABELS } from "@/lib/order-status";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-display";

// Radix Select forbids an empty-string item value, so "All" uses this sentinel.
const ALL = "ALL";

export type AdminOrderFilterValues = {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
};

const STATUS_OPTIONS = Object.entries(ADMIN_ORDER_STATUS_LABELS) as [
  OrderStatus,
  string,
][];
const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS) as [
  PaymentMethod,
  string,
][];

export function OrderFilters({ filters }: { filters: AdminOrderFilterValues }) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState(filters.search ?? "");

  const apply = React.useCallback(
    (next: AdminOrderFilterValues) => {
      const params = new URLSearchParams();
      if (next.status) params.set("status", next.status);
      if (next.paymentMethod) params.set("paymentMethod", next.paymentMethod);
      if (next.search) params.set("search", next.search);
      // A filter change resets pagination — page N of the old set is meaningless.
      const qs = params.toString();
      router.push(`/admin/orders${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router],
  );

  // Keep the input in sync when the URL changes underneath us (back button).
  const urlSearch = filters.search ?? "";
  React.useEffect(() => {
    setSearchValue(urlSearch);
  }, [urlSearch]);

  // Debounced search → URL. 300ms after the last keystroke, push if changed.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchValue.trim();
      if (trimmed !== urlSearch) {
        apply({ ...filters, search: trimmed || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const hasActiveFilters = Boolean(
    filters.status || filters.paymentMethod || filters.search,
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        type="search"
        placeholder="Search order # or customer…"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="sm:max-w-xs"
        aria-label="Search orders"
      />

      <Select
        value={filters.status ?? ALL}
        onValueChange={(value) =>
          apply({
            ...filters,
            status: value === ALL ? undefined : (value as OrderStatus),
          })
        }
      >
        <SelectTrigger className="w-56" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.paymentMethod ?? ALL}
        onValueChange={(value) =>
          apply({
            ...filters,
            paymentMethod: value === ALL ? undefined : (value as PaymentMethod),
          })
        }
      >
        <SelectTrigger className="w-44" aria-label="Filter by payment method">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All methods</SelectItem>
          {METHOD_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Link
          href="/admin/orders"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
