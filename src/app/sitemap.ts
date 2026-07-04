import type { MetadataRoute } from "next";

// Served at /sitemap.xml (Next.js Metadata Files API).
// B.2 NOTE: when the product catalog ships, fetch active products here and
// append their /products/[slug] URLs dynamically.
export default function sitemap(): MetadataRoute.Sitemap {
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

  return staticPaths.map(({ path, priority }) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
