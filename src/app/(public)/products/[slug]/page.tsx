import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { ProductGallery } from "@/components/product/product-gallery";
import { RobotPlaceholder } from "@/components/product/robot-placeholder";
import { Badge } from "@/components/ui/badge";
import { ogImageUrl } from "@/lib/cloudinary-url";
import { formatBdt } from "@/lib/format";
import { normalizeFeatures } from "@/lib/product-features";
import { normalizeSpecs } from "@/lib/product-specs";
import * as productService from "@/services/product-service";

type Props = { params: Promise<{ slug: string }> };

type ProductImage = { url: string; type: "IMAGE" | "VIDEO"; isPrimary: boolean };

// The lead image for social cards / structured data: the primary IMAGE if one
// is flagged, else the first IMAGE. Videos are never used (need a still frame).
function primaryImageUrl(images: ProductImage[]): string | null {
  const imageOnly = images.filter((m) => m.type === "IMAGE");
  const primary = imageOnly.find((m) => m.isPrimary) ?? imageOnly[0];
  return primary ? primary.url : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productService.getBySlug(slug);
  if (!product) return {};

  const description = product.shortDescription ?? undefined;
  const lead = primaryImageUrl(product.images);
  // A 1200×630 OG derivative when the product has an image; otherwise omit
  // `images` so the site-wide default OG image (root layout) is inherited.
  const ogImages = lead
    ? [{ url: ogImageUrl(lead), width: 1200, height: 630, alt: product.name }]
    : undefined;

  return {
    title: product.name,
    description,
    openGraph: {
      type: "website",
      title: `${product.name} — Xarvisrobo`,
      description,
      url: `/products/${product.slug}`,
      ...(ogImages ? { images: ogImages } : {}),
    },
    ...(lead
      ? {
          twitter: {
            card: "summary_large_image",
            title: `${product.name} — Xarvisrobo`,
            description,
            images: [ogImageUrl(lead)],
          },
        }
      : {}),
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await productService.getBySlug(slug);
  if (!product) notFound();

  const isPriceTbd = Number(product.basePrice) === 0;
  // Ordered { label, value }[] — array order is preserved by jsonb (fixes B.2).
  const specs = normalizeSpecs(product.specifications);
  // Ordered { title, description }[] feature highlights (Phase H #6).
  const features = normalizeFeatures(product.features);

  // schema.org Product structured data (Phase J.3 Part E). Only claims what we
  // actually have: offers appear only when a real price is set (never a
  // fabricated price/availability), and there is no aggregateRating (no reviews
  // in v1). Availability reflects real stock.
  const lead = primaryImageUrl(product.images);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    sku: product.sku,
    brand: { "@type": "Brand", name: "Xarvisrobo" },
    ...(lead ? { image: [ogImageUrl(lead)] } : {}),
    ...(isPriceTbd
      ? {}
      : {
          offers: {
            "@type": "Offer",
            price: product.basePrice,
            priceCurrency: "BDT",
            availability:
              product.stockQuantity > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/PreOrder",
            url: `https://xarvisrobo.com/products/${product.slug}`,
          },
        }),
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      {/* Product structured data. JSON.stringify's `<` is escaped to < so
          the payload can never break out of the <script> element (XSS-safe). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Above the fold: placeholder left (60%), product info right (40%) */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-16">
        <div className="lg:col-span-3">
          {product.images.length > 0 ? (
            <ProductGallery media={product.images} productName={product.name} />
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

        {features.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Features
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
              {features.map((feature, i) => (
                <div key={`${feature.title}-${i}`}>
                  <h3 className="text-base font-medium text-neutral-900">
                    {feature.title}
                  </h3>
                  {feature.description && (
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      {feature.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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
