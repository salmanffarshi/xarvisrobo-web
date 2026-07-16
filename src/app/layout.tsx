import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Geist Mono is loaded only by the admin dashboard layout (the sole place
// font-mono is used — coupon codes). Keeping it out of the root layout means
// customer-facing pages no longer download an unused ~26 KB font file.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const SITE_NAME = "Xarvisrobo";
const SITE_DESCRIPTION =
  "Xarvisrobo builds intelligent desk companions — designed in Bangladesh, built for everyone.";
// Site-wide default social-share image. Supply a 1200×630 PNG/JPG at
// public/og-default.png (see PART E notes). Resolved against metadataBase.
const DEFAULT_OG_IMAGE = "/og-default.png";

export const metadata: Metadata = {
  // The live production domain. Every relative URL in metadata (OG/Twitter
  // images, canonical, sitemap) resolves against this.
  metadataBase: new URL("https://xarvisrobo.com"),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // Site-wide Open Graph defaults. Per-page metadata (e.g. product detail)
  // overrides title/description/url/images; anything it omits inherits these.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  // Large-image Twitter/X card — matters for WhatsApp/Facebook rich previews too.
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
