import type { MetadataRoute } from "next";

import * as productService from "@/services/product-service";

// Served at /sitemap.xml (Next.js Metadata Files API).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // PLACEHOLDER DOMAIN — see layout.tsx metadataBase.
  const base = "https://xarvisrobo.com";

  const staticPaths: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1.0 },
    { path: "/about", priority: 0.8 },
    { path: "/faq", priority: 0.8 },
    { path: "/warranty", priority: 0.8 },
    { path: "/contact", priority: 0.8 },
    { path: "/privacy", priority: 0.8 },
    { path: "/terms", priority: 0.8 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(
    ({ path, priority }) => ({
      url: `${base}${path}`,
      changeFrequency: "monthly",
      priority,
    })
  );

  const { data: products } = await productService.list({ limit: 100 });
  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${base}/products/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: product.updatedAt,
  }));

  return [...staticEntries, ...productEntries];
}
