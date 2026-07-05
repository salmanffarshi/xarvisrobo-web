import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
        Robots
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Small robots designed for real desks. Meet ours below.
      </p>

      <div className="mt-10">
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
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {result.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-24 text-center">
          {hasActiveFilters ? (
            <>
              <p className="text-lg text-neutral-600">
                No robots match those filters.
              </p>
              <Link
                href="/products"
                className="mt-3 inline-block text-sm text-neutral-600 underline underline-offset-4"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <p className="text-lg text-neutral-600">Products coming soon.</p>
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
