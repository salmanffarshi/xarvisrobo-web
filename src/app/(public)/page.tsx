import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, HeartHandshake, Puzzle } from "lucide-react";

import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import * as productService from "@/services/product-service";

export const metadata: Metadata = {
  description:
    "Xarvisrobo builds intelligent desk companions — designed in Bangladesh, built for everyone.",
  // OpenGraph/Twitter (incl. the default social image) are inherited from the
  // root layout. We intentionally don't re-declare openGraph here: Next shallow-
  // merges it, so a partial override would drop the inherited default image.
};

const PILLARS = [
  {
    icon: Cpu,
    title: "Intelligent, not artificial.",
    body: "Every Xarvisrobo device is built to feel present, not performative. Voice, movement, and expression that add up to a small companion — one that fits into how you already work.",
  },
  {
    icon: Puzzle,
    title: "Modular by design.",
    body: "Buy the robot. Keep improving it. Sensors, accessories, firmware updates — the platform is meant to grow with what you want it to do.",
  },
  {
    icon: HeartHandshake,
    title: "Accessible to everyone.",
    body: "Priced for real desks and real students, not just labs and demos. We think good robotics should be within reach.",
  },
] as const;

export default async function HomePage() {
  const featured = await productService.listFeatured(4);

  return (
    <>
      {/* Hero — text-only with a very subtle radial glow behind the content. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(59_130_246/0.06),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight text-neutral-900 md:text-7xl">
            Robots designed to belong on your desk.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 md:text-xl">
            Xarvisrobo builds intelligent desk companions — designed in
            Bangladesh, built for everyone.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {/* /products 404s until B.2 ships the catalog — expected. */}
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/products">Explore robots</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="rounded-xl text-neutral-700"
            >
              <Link href="/about">Read our story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What we're building */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
          Three ideas we&rsquo;re building around.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl bg-neutral-50 p-8">
              <pillar.icon
                className="size-9 text-primary"
                strokeWidth={1.5}
                aria-hidden
              />
              <h3 className="mt-6 text-lg font-medium tracking-tight text-neutral-900">
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
          The robots we&rsquo;re building.
        </h2>
        <p className="mt-4 text-lg text-neutral-600">
          Two designs, one philosophy — small, capable, made in Bangladesh.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <Link
          href="/products"
          className="mt-8 inline-block text-sm text-neutral-600 underline-offset-4 hover:underline"
        >
          See all robots →
        </Link>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16 pb-24 text-center sm:pb-32">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
          Curious about what we&rsquo;re making?
        </h2>
        <p className="mt-4 text-lg text-neutral-600">
          We&rsquo;d love to hear from you.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full px-8">
          <Link href="/contact">Get in touch</Link>
        </Button>
      </section>
    </>
  );
}
