// Admin category management (Phase E.4 Part B, ADR-003). Staff-guarded at the
// route; these functions own the rules: unique slug derived from the name, and
// a delete that is BLOCKED while any product still references the category.

import { db } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validations/category";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /** ALL products (active + inactive) — admin sees the true reference count. */
  productCount: number;
};

/** Thrown when deleting a category that still has products. Mapped to 409. */
export class CategoryInUseError extends Error {
  readonly code = "CATEGORY_IN_USE";
  constructor(readonly productCount: number) {
    super(
      `This category has ${productCount} product(s). Reassign or remove them before deleting.`,
    );
    this.name = "CategoryInUseError";
  }
}

/** Thrown when a category id doesn't exist. Mapped to 404. */
export class CategoryNotFoundError extends Error {
  readonly code = "CATEGORY_NOT_FOUND";
  constructor() {
    super("Category not found");
    this.name = "CategoryNotFoundError";
  }
}

/** All categories (incl. inactive), ordered by sortOrder then name, each with
 * its total product count. */
export async function list(): Promise<AdminCategory[]> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
  return rows.map(({ _count, ...category }) => ({
    ...category,
    productCount: _count.products,
  }));
}

export async function create(input: CreateCategoryInput): Promise<AdminCategory> {
  const data = createCategorySchema.parse(input);
  const slug = await uniqueSlug(data.name, async (candidate) =>
    Boolean(await db.category.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const created = await db.category.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
    select: { id: true, name: true, slug: true, description: true, sortOrder: true, isActive: true },
  });
  return { ...created, productCount: 0 };
}

export async function update(
  id: string,
  input: UpdateCategoryInput,
): Promise<void> {
  const data = updateCategorySchema.parse(input);

  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) throw new CategoryNotFoundError();

  // Re-derive the slug only when the name actually changes.
  const slug =
    data.name && data.name !== existing.name
      ? await uniqueSlug(data.name, async (candidate) =>
          Boolean(
            await db.category.findFirst({
              where: { slug: candidate, id: { not: id } },
              select: { id: true },
            }),
          ),
        )
      : undefined;

  await db.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

/** Delete a category — blocked while any product references it. */
export async function remove(id: string): Promise<void> {
  const category = await db.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { products: true } } },
  });
  if (!category) throw new CategoryNotFoundError();
  if (category._count.products > 0) {
    throw new CategoryInUseError(category._count.products);
  }
  await db.category.delete({ where: { id } });
}
