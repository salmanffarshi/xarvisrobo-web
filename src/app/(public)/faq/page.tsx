import type { Metadata } from "next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Xarvisrobo — availability, capabilities, pricing, shipping, modularity, and warranty.",
  openGraph: {
    title: "FAQ | Xarvisrobo",
    description:
      "Answers to common questions about Xarvisrobo — availability, capabilities, pricing, shipping, modularity, and warranty.",
    url: "/faq",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "When will Xarvisrobo be available?",
    answer:
      "We're finalizing our first two designs now. Reach out via the contact page and we'll notify you when pre-orders open.",
  },
  {
    question: "What can it do?",
    answer:
      "Each Xarvisrobo device combines voice interaction, expressive movement, and a set of AI-enabled features. Exact capabilities depend on the model — we'll publish full specification sheets closer to launch.",
  },
  {
    question: "How much will it cost?",
    answer:
      "We're designing for affordability first. Pricing will be announced with the first pre-order.",
  },
  {
    question: "Where do you ship?",
    answer:
      "Bangladesh at launch. International shipping is planned for a future release.",
  },
  {
    question: 'What does "modular" mean?',
    answer:
      "Xarvisrobo devices are built so that new sensors, accessories, and firmware capabilities can be added over time. You buy a robot, and it keeps growing with what you want it to do.",
  },
  {
    question: "What's the warranty?",
    answer:
      "Twelve months from date of delivery, covering hardware defects. Full terms are on our warranty page.",
  },
] as const;

export default function FaqPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
        Frequently asked questions
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Answers to the things people ask most. If you don&rsquo;t see yours
        here, our contact page is the fastest way to reach us.
      </p>

      <Accordion type="single" collapsible className="mt-12">
        {FAQ_ITEMS.map((item) => (
          <AccordionItem
            key={item.question}
            value={item.question}
            className="border-neutral-100"
          >
            <AccordionTrigger className="py-5 text-base font-medium text-neutral-900 hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-base leading-relaxed text-neutral-600">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
