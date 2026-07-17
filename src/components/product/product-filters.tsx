"use client";

// Catalog filter bar. All state lives in the URL: every interaction builds the
// next filter set, stringifies it, and pushes it to the router — the /products
// server component then re-renders with fresh data. No local results state.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stringifyProductParams } from "@/lib/product-search-params";
import type {
  ProductListFilters,
  ProductSort,
} from "@/services/product-service";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price low → high" },
  { value: "price-desc", label: "Price high → low" },
  { value: "name", label: "Name" },
];

type CategoryChip = { slug: string; name: string; productCount: number };

type ProductFiltersProps = {
  categories: CategoryChip[];
  filters: ProductListFilters;
};

export function ProductFilters({ categories, filters }: ProductFiltersProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState(filters.search ?? "");

  const apply = React.useCallback(
    (next: ProductListFilters) => {
      // Any filter change resets pagination — page N of the old filter set
      // is meaningless under the new one.
      router.push(
        `/products${stringifyProductParams({ ...next, page: undefined })}`,
        { scroll: false }
      );
    },
    [router]
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
    filters.search ||
      filters.categorySlug ||
      (filters.sort && filters.sort !== "newest")
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        type="search"
        placeholder="Search robots…"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="sm:max-w-xs"
        aria-label="Search products"
      />

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((category) => {
          const isActive = filters.categorySlug === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() =>
                apply({
                  ...filters,
                  categorySlug: isActive ? undefined : category.slug,
                })
              }
              aria-pressed={isActive}
            >
              <Badge
                variant={isActive ? "default" : "outline"}
                className={
                  isActive
                    ? "cursor-pointer px-3 py-1"
                    : "cursor-pointer px-3 py-1 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                }
              >
                {category.name} ({category.productCount})
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 sm:ml-auto">
        <Select
          value={filters.sort ?? "newest"}
          onValueChange={(value) =>
            apply({ ...filters, sort: value as ProductSort })
          }
        >
          <SelectTrigger className="w-44" aria-label="Sort products">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Link
            href="/products"
            className="text-sm text-neutral-600 underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
