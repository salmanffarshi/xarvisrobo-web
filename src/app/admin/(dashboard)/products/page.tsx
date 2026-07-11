import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { requireStaffPage } from "@/lib/auth-guards";
import { formatBdt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { list as listCategories } from "@/services/category-admin-service";
import { list as listProducts } from "@/services/product-admin-service";
import { ProductFilters } from "./product-filters";

// Admin product list (Phase E.4 Part B). Server component: reads URL filters,
// calls the admin read services, renders. Rows link to the edit page.

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireStaffPage();
  const sp = await searchParams;

  const search = sp.search?.trim() || undefined;
  const categoryId = sp.categoryId || undefined;
  const status =
    sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const requestedPage = Number(sp.page);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 1 ? requestedPage : 1;

  const [result, categories] = await Promise.all([
    listProducts({ search, categoryId, isActive: status ? status === "active" : undefined, page }),
    listCategories(),
  ]);

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.total} {result.total === 1 ? "product" : "products"}
            {(search || categoryId || status) && " matching filters"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/products/categories"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Manage categories
          </Link>
          <Link href="/admin/products/new" className={cn(buttonVariants())}>
            Add product
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <ProductFilters
          filters={{ search, categoryId, status }}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      {result.data.length === 0 ? (
        <div className="mt-6 rounded-2xl border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">No products found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.data.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="flex items-center gap-3"
                    >
                      <span className="bg-muted flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                        {p.primaryImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.primaryImageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageOff className="text-muted-foreground size-4" />
                        )}
                      </span>
                      <span className="font-medium underline-offset-4 hover:underline">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {p.sku}
                  </td>
                  <td className="px-4 py-3">{p.categoryName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatBdt(p.basePrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.stockQuantity}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          p.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-500",
                        )}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {p.isFeatured && <Badge>Featured</Badge>}
                    </div>
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
