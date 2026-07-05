// Product catalog business logic (ADR-003: services own the rules; API
// routes and pages are glue only). The future mobile app reuses this via
// GET /api/v1/products and GET /api/v1/products/:slug.
//
// Money convention: basePrice is a Prisma Decimal in the DB and a string
// (e.g. "2999.00") everywhere past this layer, so nothing downstream ever
// does float math on prices (ADR-005 territory once cart lands in Phase C).

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name";

export type ProductListFilters = {
  search?: string;
  categorySlug?: string;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
};

/** Trimmed shape for grids and lists — no long description or specs. */
export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  basePrice: string;
  currency: "BDT";
  isFeatured: boolean;
  categoryName: string;
  stockQuantity: number;
};

export type ProductListResult = {
  data: ProductCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Full shape for the detail page and GET /products/:slug. */
export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string;
  basePrice: string;
  currency: "BDT";
  stockQuantity: number;
  isFeatured: boolean;
  specifications: Prisma.JsonValue;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string };
  images: {
    id: string;
    url: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }[];
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  shortDescription: true,
  basePrice: true,
  isFeatured: true,
  stockQuantity: true,
  category: { select: { name: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(row: CardRow): ProductCard {
  const { category, basePrice, ...rest } = row;
  return {
    ...rest,
    basePrice: basePrice.toFixed(2),
    currency: "BDT",
    categoryName: category.name,
  };
}

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  "price-asc": { basePrice: "asc" },
  "price-desc": { basePrice: "desc" },
  name: { name: "asc" },
};

/**
 * Paginated, filterable list of ACTIVE products. Search is case-insensitive
 * across name + shortDescription. Defaults: page 1, limit 12 (capped at 100),
 * newest first.
 */
export async function list(
  filters: ProductListFilters = {}
): Promise<ProductListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            {
              shortDescription: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(filters.categorySlug
      ? { category: { slug: filters.categorySlug } }
      : {}),
    ...(filters.featured !== undefined ? { isFeatured: filters.featured } : {}),
  };

  // One transaction so count and page rows see the same snapshot.
  const [total, rows] = await db.$transaction([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: ORDER_BY[filters.sort ?? "newest"],
      skip: (page - 1) * limit,
      take: limit,
      select: cardSelect,
    }),
  ]);

  return {
    data: rows.map(toCard),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/** Full product by slug, or null if missing/inactive. */
export async function getBySlug(slug: string): Promise<ProductDetail | null> {
  const row = await db.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.shortDescription,
    description: row.description,
    basePrice: row.basePrice.toFixed(2),
    currency: "BDT",
    stockQuantity: row.stockQuantity,
    isFeatured: row.isFeatured,
    specifications: row.specifications ?? null,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: row.category,
    images: row.images,
  };
}

/** Featured + active products for the home page, newest first. */
export async function listFeatured(limit = 4): Promise<ProductCard[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}
