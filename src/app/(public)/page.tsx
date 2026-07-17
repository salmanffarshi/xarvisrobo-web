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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-5%,rgb(59_130_246/0.08),transparent)]"
        />
        <div className="container-page relative py-24 text-center sm:py-32">
          <p className="text-eyebrow">Desk robotics, from Bangladesh</p>
          <h1 className="text-display mx-auto mt-5 max-w-4xl lg:text-7xl">
            Robots designed to belong on your desk.
          </h1>
          <p className="text-lead mx-auto mt-6 max-w-2xl">
            Xarvisrobo builds intelligent desk companions — designed in
            Bangladesh, built for everyone.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/products">Explore robots</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full px-8"
            >
              <Link href="/about">Read our story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What we're building */}
      <section className="container-page section-py">
        <p className="text-eyebrow">What we&rsquo;re building</p>
        <h2 className="text-h2 mt-3 max-w-2xl">
          Three ideas we&rsquo;re building around.
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className="group rounded-2xl border border-neutral-200/70 bg-white p-8 shadow-soft transition-shadow duration-200 hover:shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <pillar.icon className="size-6" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="text-sm font-medium tabular-nums text-neutral-300">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-h3">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="container-page section-py">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow">The lineup</p>
            <h2 className="text-h2 mt-3">The robots we&rsquo;re building.</h2>
            <p className="text-lead mt-4">
              Two designs, one philosophy — small, capable, made in Bangladesh.
            </p>
          </div>
          <Link
            href="/products"
            className="group inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            See all robots
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Closing CTA — a designed band, not plain centered text. */}
      <section className="container-page pb-24 pt-4 sm:pb-32">
        <div className="relative overflow-hidden rounded-3xl border border-neutral-200/70 bg-neutral-50 px-6 py-16 text-center sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgb(59_130_246/0.08),transparent)]"
          />
          <div className="relative">
            <h2 className="text-h2 mx-auto max-w-xl">
              Curious about what we&rsquo;re making?
            </h2>
            <p className="text-lead mx-auto mt-4 max-w-lg">
              We&rsquo;d love to hear from you.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full px-8">
              <Link href="/contact">Get in touch</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
