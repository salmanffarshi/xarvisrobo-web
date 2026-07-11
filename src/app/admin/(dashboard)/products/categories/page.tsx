import type { Metadata } from "next";
import Link from "next/link";

import { requireStaffPage } from "@/lib/auth-guards";
import { list } from "@/services/category-admin-service";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireStaffPage();
  const categories = await list();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/admin/products"
        className="text-muted-foreground mb-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Products
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A category can’t be deleted while products reference it.
        </p>
      </header>

      <CategoryManager categories={categories} />
    </div>
  );
}
