// Category catalog business logic (ADR-003: services own the rules; API
// routes and pages are glue only). The future mobile app reuses this via
// GET /api/v1/categories.

import { db } from "@/lib/db";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  /** Count of ACTIVE products only — what a public visitor could actually see. */
  productCount: number;
};

/**
 * All active categories ordered by sortOrder, each with its active-product
 * count (for "(2)" hints next to filter chips).
 */
export async function list(): Promise<CategorySummary[]> {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return categories.map(({ _count, ...category }) => ({
    ...category,
    productCount: _count.products,
  }));
}

/** Single active category by slug, or null if missing/inactive. */
export async function getBySlug(
  slug: string
): Promise<Omit<CategorySummary, "productCount"> | null> {
  return db.category.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
    },
  });
}
