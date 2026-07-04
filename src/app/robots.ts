import type { MetadataRoute } from "next";

// Served at /robots.txt (Next.js Metadata Files API). Public pages are
// crawlable; the admin area, the API, and the customer account area are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/account"],
    },
    sitemap: "https://xarvisrobo.com/sitemap.xml", // PLACEHOLDER DOMAIN — see layout.tsx metadataBase
  };
}
