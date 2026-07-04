import type { Metadata } from "next";

import { PlaceholderBanner } from "@/components/legal/placeholder-banner";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Xarvisrobo collects, uses, and protects your data. Placeholder pending legal review.",
  openGraph: {
    title: "Privacy Policy | Xarvisrobo",
    description:
      "How Xarvisrobo collects, uses, and protects your data. Placeholder pending legal review.",
    url: "/privacy",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

const SECTIONS = [
  "What we collect",
  "How we use it",
  "Sharing with third parties",
  "Data retention",
  "Your rights",
  "Cookies",
  "Contact us about privacy",
] as const;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
        Privacy Policy
      </h1>

      <div className="mt-8">
        <PlaceholderBanner />
      </div>

      {SECTIONS.map((heading) => (
        <section key={heading} className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-500">
            [Placeholder — content pending legal review.]
          </p>
        </section>
      ))}
    </article>
  );
}
