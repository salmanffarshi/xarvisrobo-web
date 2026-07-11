import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";
import { Badge } from "@/components/ui/badge";
import { formatBdt } from "@/lib/format";
import { normalizeSpecs } from "@/lib/product-specs";
import * as productService from "@/services/product-service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productService.getBySlug(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.shortDescription ?? undefined,
    openGraph: {
      title: `${product.name} — Xarvisrobo`,
      description: product.shortDescription ?? undefined,
      url: `/products/${product.slug}`,
      siteName: "Xarvisrobo",
      locale: "en_US",
      type: "website",
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await productService.getBySlug(slug);
  if (!product) notFound();

  const isPriceTbd = Number(product.basePrice) === 0;
  // Ordered { label, value }[] — array order is preserved by jsonb (fixes B.2).
  const specs = normalizeSpecs(product.specifications);
  // Gallery: primary first, then the rest by sort order (already sorted by the
  // service). Empty → the SVG placeholder hero.
  const [hero, ...moreImages] = [...product.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      {/* Above the fold: placeholder left (60%), product info right (40%) */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-16">
        <div className="lg:col-span-3">
          {hero ? (
            <div className="space-y-3">
              <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.url}
                  alt={hero.altText ?? product.name}
                  className="size-full object-cover"
                />
              </div>
              {moreImages.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {moreImages.map((img) => (
                    <div
                      key={img.id}
                      className="aspect-square overflow-hidden rounded-xl bg-neutral-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.altText ?? product.name}
                        className="size-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <RobotPlaceholder
              slug={product.slug}
              name={product.name}
              variant="hero"
            />
          )}
        </div>

        <div className="lg:col-span-2">
          <Link
            href={`/products?category=${product.category.slug}`}
            className="text-sm text-neutral-600 underline-offset-4 hover:underline"
          >
            {product.category.name}
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 lg:text-5xl">
            {product.name}
          </h1>
          {product.shortDescription && (
            <p className="mt-4 text-lg text-neutral-600">
              {product.shortDescription}
            </p>
          )}

          <p className="mt-6 text-2xl font-medium tabular-nums text-neutral-900">
            {isPriceTbd
              ? "Pricing announced at pre-order"
              : formatBdt(product.basePrice)}
          </p>

          <Badge variant="secondary" className="mt-3">
            {product.stockQuantity > 0 ? "In stock" : "Pre-order"}
          </Badge>

          <div className="mt-8">
            <AddToCartButton productId={product.id} />
            <p className="mt-4 text-sm text-neutral-600">
              Questions about this robot?{" "}
              <Link
                href="/contact"
                className="underline underline-offset-4 hover:text-neutral-900"
              >
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Below the fold: long description, specs, warranty note */}
      <div className="mx-auto mt-24 max-w-3xl">
        <div className="space-y-6 text-lg leading-relaxed text-neutral-700">
          {product.description.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {specs.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Specifications
            </h2>
            <dl className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
              {specs.map((spec, i) => (
                <div
                  key={`${spec.label}-${i}`}
                  className="grid grid-cols-1 gap-1 px-5 py-3.5 odd:bg-neutral-50 sm:grid-cols-[200px_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-medium text-neutral-900">
                    {spec.label}
                  </dt>
                  <dd className="text-sm text-neutral-600">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="mt-16 text-sm text-neutral-600">
          Covered by the Xarvisrobo warranty.{" "}
          <Link
            href="/warranty"
            className="underline underline-offset-4 hover:text-neutral-900"
          >
            Read the warranty terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
