import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Xarvisrobo makes robotics that fits into daily life — designed and assembled in Bangladesh, approachable by design.",
  openGraph: {
    title: "About | Xarvisrobo",
    description:
      "Xarvisrobo makes robotics that fits into daily life — designed and assembled in Bangladesh, approachable by design.",
    url: "/about",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

const SECTIONS = [
  {
    heading: "Made for the desk. Made for everyone.",
    body: "We started Xarvisrobo to make robotics that fits into daily life. Not a gimmick. Not a luxury. A well-made desk companion that quietly earns its place — capable enough to be useful, small enough to disappear when it's not.",
  },
  {
    heading: "Designed and built in Bangladesh.",
    body: "Every Xarvisrobo device — from the circuit board to the firmware to the finished shell — is designed and assembled in our workshop. Bangladesh has a generation of engineers ready to build things the world uses. We're one of them, and we're glad to be building here.",
  },
  {
    heading: "Approachable by design.",
    body: "Small footprint. Simple setup. Friendly form. Our robots don't ask you to become a robotics enthusiast. They just work — quietly, reliably, and with personality — on your desk.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-6 pt-24 sm:pt-32">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
          About Xarvisrobo
        </h1>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.heading} className="mx-auto max-w-3xl px-6 py-24">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
            {section.heading}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-700">
            {section.body}
          </p>
        </section>
      ))}
    </>
  );
}
