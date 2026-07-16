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

export const metadata: Metadata = {
  // PLACEHOLDER DOMAIN — no domain is registered yet. Once one exists, move
  // this to an env var (e.g. NEXT_PUBLIC_SITE_URL) so preview/prod differ.
  metadataBase: new URL("https://xarvisrobo.com"),
  title: {
    default: "Xarvisrobo",
    template: "%s | Xarvisrobo",
  },
  description:
    "Xarvisrobo builds intelligent desk companions — designed in Bangladesh, built for everyone.",
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
