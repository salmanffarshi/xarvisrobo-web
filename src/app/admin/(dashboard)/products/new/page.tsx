import type { Metadata } from "next";
import Link from "next/link";

import { requireStaffPage } from "@/lib/auth-guards";
import { list as listCategories } from "@/services/category-admin-service";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

// Create a product (Phase E.4 Part B). Images are added after saving, on the
// edit page (they need a product id to attach to).
export default async function NewProductPage() {
  await requireStaffPage();
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/admin/products"
        className="text-muted-foreground mb-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Products
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New product</h1>

      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Create a category first — a product needs one.{" "}
          <Link href="/admin/products/categories" className="underline">
            Manage categories
          </Link>
          .
        </p>
      ) : (
        <ProductForm
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
