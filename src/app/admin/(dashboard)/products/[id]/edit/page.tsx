import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStaffPage } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { list as listCategories } from "@/services/category-admin-service";
import { get } from "@/services/product-admin-service";
import { ProductForm } from "../../product-form";
import { ImageManager } from "../../image-manager";
import { ProductDangerZone } from "../../product-danger-zone";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffPage();
  const { id } = await params;

  const [product, categories, orderItemCount] = await Promise.all([
    get(id),
    listCategories(),
    db.orderItem.count({ where: { productId: id } }),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/admin/products"
        className="text-muted-foreground mb-4 inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Products
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{product.name}</h1>

      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: product.id,
          values: {
            name: product.name,
            sku: product.sku,
            shortDescription: product.shortDescription ?? "",
            description: product.description,
            categoryId: product.categoryId,
            basePrice: product.basePrice,
            stockQuantity: product.stockQuantity,
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            specifications: product.specifications,
            features: product.features,
            metaTitle: product.metaTitle ?? "",
            metaDescription: product.metaDescription ?? "",
          },
        }}
      />

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Media</h2>
        <ImageManager productId={product.id} images={product.images} />
      </section>

      <section className="mt-8">
        <ProductDangerZone
          productId={product.id}
          isActive={product.isActive}
          hasOrders={orderItemCount > 0}
        />
      </section>
    </div>
  );
}
