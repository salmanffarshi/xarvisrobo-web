import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PackageOpen } from "lucide-react";

import { ProductCard } from "@/components/product/product-card";
import { ProductFilters } from "@/components/product/product-filters";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  parseProductParams,
  stringifyProductParams,
} from "@/lib/product-search-params";
import * as categoryService from "@/services/category-service";
import * as productService from "@/services/product-service";
import type { ProductListFilters } from "@/services/product-service";

export const metadata: Metadata = {
  title: "Robots",
  description: "Small robots designed for real desks. Meet ours below.",
  openGraph: {
    title: "Robots — Xarvisrobo",
    description: "Small robots designed for real desks. Meet ours below.",
    url: "/products",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

function pageHref(filters: ProductListFilters, page: number): string {
  return `/products${stringifyProductParams({ ...filters, page })}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseProductParams(await searchParams);

  const [result, categories] = await Promise.all([
    productService.list(filters),
    categoryService.list(),
  ]);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.categorySlug ||
      (filters.sort && filters.sort !== "newest")
  );

  return (
    <div className="container-page py-16 sm:py-24">
      <p className="text-eyebrow">Catalog</p>
      <h1 className="text-display mt-3">Robots</h1>
      <p className="text-lead mt-4">
        Small robots designed for real desks. Meet ours below.
      </p>

      <div className="mt-10 border-t border-neutral-200 pt-6">
        <ProductFilters
          categories={categories.map(({ slug, name, productCount }) => ({
            slug,
            name,
            productCount,
          }))}
          filters={filters}
        />
      </div>

      {result.data.length > 0 ? (
        <>
          <p className="mt-8 text-sm text-neutral-500">
            {result.total} {result.total === 1 ? "robot" : "robots"}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {result.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-neutral-400 shadow-soft">
            <PackageOpen className="size-7" strokeWidth={1.5} aria-hidden />
          </span>
          {hasActiveFilters ? (
            <>
              <p className="mt-6 text-lg text-neutral-900">
                No robots match those filters.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Try a different search or category.
              </p>
              <Link
                href="/products"
                className="mt-5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p className="mt-6 text-lg text-neutral-900">
                Products coming soon.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Our first robots are on the way — check back shortly.
              </p>
            </>
          )}
        </div>
      )}

      {result.totalPages > 1 && (
        <Pagination className="mt-12">
          <PaginationContent>
            {result.page > 1 && (
              <PaginationItem>
                <Link
                  href={pageHref(filters, result.page - 1)}
                  aria-label="Go to previous page"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 px-2.5"
                  )}
                >
                  <ChevronLeftIcon className="size-4" />
                  <span className="hidden sm:block">Previous</span>
                </Link>
              </PaginationItem>
            )}
            {Array.from({ length: result.totalPages }, (_, i) => i + 1).map(
              (page) => (
                <PaginationItem key={page}>
                  <Link
                    href={pageHref(filters, page)}
                    aria-current={page === result.page ? "page" : undefined}
                    className={buttonVariants({
                      variant: page === result.page ? "outline" : "ghost",
                      size: "icon",
                    })}
                  >
                    {page}
                  </Link>
                </PaginationItem>
              )
            )}
            {result.page < result.totalPages && (
              <PaginationItem>
                <Link
                  href={pageHref(filters, result.page + 1)}
                  aria-label="Go to next page"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "default" }),
                    "gap-1 px-2.5"
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
