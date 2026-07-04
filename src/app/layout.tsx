import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
