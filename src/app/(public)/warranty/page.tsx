import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warranty",
  description:
    "Every Xarvisrobo device is covered by a twelve-month limited warranty starting from the date of delivery.",
  openGraph: {
    title: "Warranty | Xarvisrobo",
    description:
      "Every Xarvisrobo device is covered by a twelve-month limited warranty starting from the date of delivery.",
    url: "/warranty",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

export default function WarrantyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <p className="text-eyebrow">Warranty</p>
      <h1 className="text-display mt-3">Warranty</h1>
      <p className="text-lead mt-5">
        Every Xarvisrobo device is covered by a twelve-month limited warranty
        starting from the date of delivery. Here&rsquo;s what that covers.
      </p>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          What&rsquo;s covered
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-neutral-700 marker:text-neutral-400">
          <li>Manufacturing defects</li>
          <li>Component failure under normal use</li>
          <li>Firmware issues not caused by user modification</li>
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          What&rsquo;s not covered
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-neutral-700 marker:text-neutral-400">
          <li>Physical damage from drops, spills, or misuse</li>
          <li>Damage from unauthorized modifications or third-party firmware</li>
          <li>Cosmetic wear and tear</li>
          <li>Consumable parts (adhesives, small fasteners)</li>
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          How to file a claim
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-neutral-700">
          Contact us with your order number and a short description of the
          issue. Include photos if the problem is visible.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Response time
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-neutral-700">
          We aim to respond within three business days of receiving a claim.
        </p>
      </section>
    </article>
  );
}
