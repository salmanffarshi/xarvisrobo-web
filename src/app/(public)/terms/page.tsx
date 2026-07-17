import type { Metadata } from "next";
import Link from "next/link";

import { PlaceholderBanner } from "@/components/legal/placeholder-banner";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms that govern your use of Xarvisrobo. Placeholder pending legal review.",
  openGraph: {
    title: "Terms & Conditions | Xarvisrobo",
    description:
      "The terms that govern your use of Xarvisrobo. Placeholder pending legal review.",
    url: "/terms",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

const SECTIONS = [
  "Acceptance of terms",
  "Use of the service",
  "Purchases and orders",
  "Warranty reference",
  "Limitation of liability",
  "Governing law (Bangladesh)",
  "Changes to these terms",
] as const;

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <p className="text-eyebrow">Legal</p>
      <h1 className="text-display mt-3">Terms &amp; Conditions</h1>

      <div className="mt-8">
        <PlaceholderBanner />
      </div>

      {SECTIONS.map((heading) => (
        <section key={heading} className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {heading}
          </h2>
          {heading === "Warranty reference" ? (
            <p className="mt-4 text-lg leading-relaxed text-neutral-500">
              [Placeholder — content pending legal review.] See our{" "}
              <Link
                href="/warranty"
                className="text-neutral-700 underline underline-offset-4 transition-colors duration-200 hover:text-neutral-900"
              >
                warranty page
              </Link>{" "}
              for current coverage details.
            </p>
          ) : (
            <p className="mt-4 text-lg leading-relaxed text-neutral-500">
              [Placeholder — content pending legal review.]
            </p>
          )}
        </section>
      ))}
    </article>
  );
}
