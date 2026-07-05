// Parse/stringify helpers for catalog URL state (?search=&category=&sort=&page=).
// The /products server page parses searchParams with these; the client filter
// controls stringify the next state and push it to the router. One source of
// truth for both directions keeps URLs shareable and the back button honest.

import type {
  ProductListFilters,
  ProductSort,
} from "@/services/product-service";

const SORT_VALUES: ProductSort[] = ["newest", "price-asc", "price-desc", "name"];

function first(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

/**
 * URL search params → ProductListFilters. The URL is user-editable, so
 * anything malformed silently falls back to the default (no error UI for a
 * hand-mangled query string).
 */
export function parseProductParams(
  searchParams: Record<string, string | string[] | undefined>
): ProductListFilters {
  const search = first(searchParams.search)?.trim() || undefined;
  const categorySlug = first(searchParams.category)?.trim() || undefined;

  const rawSort = first(searchParams.sort);
  const sort = SORT_VALUES.find((s) => s === rawSort);

  return {
    search,
    categorySlug,
    sort,
    page: toPositiveInt(first(searchParams.page)),
  };
}

/**
 * ProductListFilters → query string ("?category=desk-robots&sort=price-asc",
 * or "" when everything is default). Omits empty values, default sort, and
 * page 1 so the canonical URL stays clean.
 */
export function stringifyProductParams(filters: ProductListFilters): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `?${query}` : "";
}
