import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ProductCardAddButton } from "@/components/product/product-card-add-button";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";
import { formatBdt } from "@/lib/format";
import type { ProductCard as ProductCardData } from "@/services/product-service";

export function ProductCard({ product }: { product: ProductCardData }) {
  // basePrice 0 = price not announced yet (template "TBD" convention).
  const isPriceTbd = Number(product.basePrice) === 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block rounded-2xl border border-neutral-200 bg-white transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative p-3">
        {product.primaryImageUrl ? (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-50">
            {/* next/image + custom Cloudinary loader: the srcset requests
                f_auto,q_auto,w_<device-width> derivatives instead of the
                full-res original. `sizes` matches the grid (1 col mobile /
                2 sm / 3 lg) so each device downloads the right width. */}
            <Image
              src={product.primaryImageUrl}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <RobotPlaceholder
            slug={product.slug}
            name={product.name}
            variant="card"
          />
        )}
        {product.isFeatured && (
          <Badge className="absolute right-5 top-5">Featured</Badge>
        )}
      </div>
      <div className="px-5 pb-5 pt-1">
        <h3 className="font-medium tracking-tight text-neutral-900">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
          {product.shortDescription}
        </p>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-medium tabular-nums text-neutral-900">
            {isPriceTbd ? "TBD — pre-order" : formatBdt(product.basePrice)}
          </span>
          <span className="text-xs text-neutral-500">
            {product.stockQuantity > 0 ? "In stock" : "Pre-order"}
          </span>
        </div>
        <div className="mt-4">
          <ProductCardAddButton productId={product.id} />
        </div>
      </div>
    </Link>
  );
}
