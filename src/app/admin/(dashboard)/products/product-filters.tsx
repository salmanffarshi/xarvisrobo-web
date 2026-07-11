"use client";

// Admin product-list filter bar (URL-as-state, same pattern as the order list).
// Search (debounced) + category + status (all / active / inactive) push to the
// router; the /admin/products server component re-renders with fresh data.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "ALL";

export type ProductFilterValues = {
  search?: string;
  categoryId?: string;
  status?: "active" | "inactive";
};

export function ProductFilters({
  filters,
  categories,
}: {
  filters: ProductFilterValues;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState(filters.search ?? "");

  const apply = React.useCallback(
    (next: ProductFilterValues) => {
      const params = new URLSearchParams();
      if (next.search) params.set("search", next.search);
      if (next.categoryId) params.set("categoryId", next.categoryId);
      if (next.status) params.set("status", next.status);
      const qs = params.toString();
      router.push(`/admin/products${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router],
  );

  const urlSearch = filters.search ?? "";
  React.useEffect(() => {
    setSearchValue(urlSearch);
  }, [urlSearch]);

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

  const hasActive = Boolean(filters.search || filters.categoryId || filters.status);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        type="search"
        placeholder="Search name or SKU…"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="sm:max-w-xs"
        aria-label="Search products"
      />

      <Select
        value={filters.categoryId ?? ALL}
        onValueChange={(value) =>
          apply({ ...filters, categoryId: value === ALL ? undefined : value })
        }
      >
        <SelectTrigger className="w-52" aria-label="Filter by category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status ?? ALL}
        onValueChange={(value) =>
          apply({
            ...filters,
            status: value === ALL ? undefined : (value as "active" | "inactive"),
          })
        }
      >
        <SelectTrigger className="w-40" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Link
          href="/admin/products"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
