// Admin product management (Phase E.4 Part B, ADR-003). Staff-guarded at the
// route; these functions own the rules: unique slug + SKU, soft-delete as the
// default (preserves order history), a guarded hard-delete (blocked if any order
// references the product), and image ops (add / set-primary / reorder / remove).
//
// Money is a Decimal in the DB and a string on the wire (ADR-005). Specs are an
// ordered { label, value }[] (Part B B1).

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { normalizeFeatures, type ProductFeature } from "@/lib/product-features";
import { normalizeSpecs, type ProductSpec } from "@/lib/product-specs";
import { uniqueSlug } from "@/lib/slug";
import {
  addImageSchema,
  createProductSchema,
  updateImageSchema,
  updateProductSchema,
  type AddImageInput,
  type CreateProductInput,
  type UpdateImageInput,
  type UpdateProductInput,
} from "@/lib/validations/product";

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  basePrice: string;
  stockQuantity: number;
  isActive: boolean;
  isFeatured: boolean;
  categoryName: string;
  primaryImageUrl: string | null;
};

export type AdminProductImage = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  type: "IMAGE" | "VIDEO";
};

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string;
  categoryId: string;
  basePrice: string;
  stockQuantity: number;
  isActive: boolean;
  isFeatured: boolean;
  specifications: ProductSpec[];
  features: ProductFeature[];
  metaTitle: string | null;
  metaDescription: string | null;
  images: AdminProductImage[];
};

export type AdminProductListResult = {
  data: AdminProductListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const MAX_LIMIT = 50;

/** Thrown when the SKU is already taken. Mapped to 409. */
export class SkuTakenError extends Error {
  readonly code = "SKU_TAKEN";
  constructor() {
    super("That SKU is already in use.");
    this.name = "SkuTakenError";
  }
}

/** Thrown when a product id doesn't exist. Mapped to 404. */
export class ProductNotFoundError extends Error {
  readonly code = "PRODUCT_NOT_FOUND";
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

/** Thrown when trying to set a video as the primary media. Mapped to 400.
 * Primary must be an image — the detail page leads with an image (Phase H #7). */
export class PrimaryMustBeImageError extends Error {
  readonly code = "PRIMARY_MUST_BE_IMAGE";
  constructor() {
    super("Only an image can be the primary media. Videos are gallery items.");
    this.name = "PrimaryMustBeImageError";
  }
}

/** Thrown when hard-deleting a product that has orders. Mapped to 409. */
export class ProductHasOrdersError extends Error {
  readonly code = "PRODUCT_HAS_ORDERS";
  constructor() {
    super(
      "This product appears on existing orders and can't be permanently deleted. Deactivate it instead.",
    );
    this.name = "ProductHasOrdersError";
  }
}

export interface AdminProductFilters {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

/** All products (active + inactive), newest first, paginated. */
export async function list(
  filters: AdminProductFilters = {},
): Promise<AdminProductListResult> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), MAX_LIMIT);
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();

  const where: Prisma.ProductWhereInput = {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        basePrice: true,
        stockQuantity: true,
        isActive: true,
        isFeatured: true,
        category: { select: { name: true } },
        images: {
          where: { type: "IMAGE" },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { url: true },
        },
      },
    }),
  ]);

  const data: AdminProductListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    basePrice: row.basePrice.toFixed(2),
    stockQuantity: row.stockQuantity,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    categoryName: row.category.name,
    primaryImageUrl: row.images[0]?.url ?? null,
  }));

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Full product detail (images ordered, specs normalized). Null if missing. */
export async function get(id: string): Promise<AdminProductDetail | null> {
  const row = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
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
    categoryId: row.categoryId,
    basePrice: row.basePrice.toFixed(2),
    stockQuantity: row.stockQuantity,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    specifications: normalizeSpecs(row.specifications),
    features: normalizeFeatures(row.features),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    images: row.images.map((img) => ({
      id: img.id,
      url: img.url,
      altText: img.altText,
      sortOrder: img.sortOrder,
      isPrimary: img.isPrimary,
      type: img.type,
    })),
  };
}

async function skuExists(sku: string, excludeId?: string): Promise<boolean> {
  const row = await db.product.findFirst({
    where: { sku, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return Boolean(row);
}

export async function create(input: CreateProductInput): Promise<{ id: string }> {
  const data = createProductSchema.parse(input);

  if (await skuExists(data.sku)) throw new SkuTakenError();

  const slug = await uniqueSlug(data.name, async (candidate) =>
    Boolean(
      await db.product.findUnique({ where: { slug: candidate }, select: { id: true } }),
    ),
  );

  try {
    const created = await db.product.create({
      data: {
        name: data.name,
        slug,
        sku: data.sku,
        shortDescription: data.shortDescription ?? null,
        description: data.description,
        categoryId: data.categoryId,
        basePrice: data.basePrice,
        stockQuantity: data.stockQuantity,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        specifications: data.specifications ?? [],
        features: data.features ?? [],
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
      },
      select: { id: true },
    });
    return created;
  } catch (error) {
    // Concurrent SKU insert (unique constraint) — surface as the typed error.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new SkuTakenError();
    }
    throw error;
  }
}

export async function update(
  id: string,
  input: UpdateProductInput,
): Promise<void> {
  const data = updateProductSchema.parse(input);

  const existing = await db.product.findUnique({
    where: { id },
    select: { id: true, name: true, sku: true },
  });
  if (!existing) throw new ProductNotFoundError();

  if (data.sku && data.sku !== existing.sku && (await skuExists(data.sku, id))) {
    throw new SkuTakenError();
  }

  const slug =
    data.name && data.name !== existing.name
      ? await uniqueSlug(data.name, async (candidate) =>
          Boolean(
            await db.product.findFirst({
              where: { slug: candidate, id: { not: id } },
              select: { id: true },
            }),
          ),
        )
      : undefined;

  await db.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(data.sku !== undefined ? { sku: data.sku } : {}),
      ...(data.shortDescription !== undefined
        ? { shortDescription: data.shortDescription || null }
        : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
      ...(data.stockQuantity !== undefined ? { stockQuantity: data.stockQuantity } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
      ...(data.specifications !== undefined
        ? { specifications: data.specifications }
        : {}),
      ...(data.features !== undefined ? { features: data.features } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle || null } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription || null }
        : {}),
    },
  });
}

/** Default delete: deactivate. Hides from the catalog, preserves order history. */
export async function softDelete(id: string): Promise<void> {
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ProductNotFoundError();
  await db.product.update({ where: { id }, data: { isActive: false } });
}

/** Permanent delete — ONLY when no order references the product. Removes its
 * images (cascade) and any cart lines (transient); blocked otherwise. */
export async function hardDelete(id: string): Promise<void> {
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ProductNotFoundError();

  const orderItemCount = await db.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) throw new ProductHasOrdersError();

  await db.$transaction(async (tx) => {
    // Cart lines are transient and would otherwise block the FK delete.
    await tx.cartItem.deleteMany({ where: { productId: id } });
    // ProductImages cascade on product delete.
    await tx.product.delete({ where: { id } });
  });
}

// ── Image ops ───────────────────────────────────────────────────────────────

async function requireProduct(id: string): Promise<void> {
  const p = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!p) throw new ProductNotFoundError();
}

/** Append a media item (image or video). Videos are never primary; an image
 * becomes primary only when the product has no primary image yet — so the
 * primary/lead media is always an image (Phase H #7). */
export async function addImage(
  productId: string,
  input: AddImageInput,
): Promise<{ id: string }> {
  const data = addImageSchema.parse(input);
  await requireProduct(productId);

  const count = await db.productImage.count({ where: { productId } });
  const hasPrimary =
    (await db.productImage.count({ where: { productId, isPrimary: true } })) > 0;
  const created = await db.productImage.create({
    data: {
      productId,
      url: data.url,
      altText: data.altText ?? null,
      sortOrder: count,
      type: data.type,
      isPrimary: data.type === "IMAGE" && !hasPrimary,
    },
    select: { id: true },
  });
  return created;
}

/** Set primary and/or sort order for one image. Setting primary clears it on the
 * product's other images (exactly one primary). */
export async function updateImage(
  productId: string,
  imageId: string,
  input: UpdateImageInput,
): Promise<void> {
  const data = updateImageSchema.parse(input);
  const image = await db.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, type: true },
  });
  if (!image) throw new ProductNotFoundError();

  // A video can never be the primary/lead media (Phase H #7).
  if (data.isPrimary === true && image.type === "VIDEO") {
    throw new PrimaryMustBeImageError();
  }

  await db.$transaction(async (tx) => {
    if (data.isPrimary === true) {
      await tx.productImage.updateMany({
        where: { productId, id: { not: imageId } },
        data: { isPrimary: false },
      });
    }
    await tx.productImage.update({
      where: { id: imageId },
      data: {
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  });
}

/** Remove one image (its Cloudinary asset is left in place for v1). If it was
 * primary and other images remain, the lowest-sorted becomes primary. */
export async function removeImage(
  productId: string,
  imageId: string,
): Promise<void> {
  const image = await db.productImage.findFirst({
    where: { id: imageId, productId },
    select: { id: true, isPrimary: true },
  });
  if (!image) throw new ProductNotFoundError();

  await db.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      // Promote the lowest-sorted IMAGE (never a video) to primary.
      const next = await tx.productImage.findFirst({
        where: { productId, type: "IMAGE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  });
}
