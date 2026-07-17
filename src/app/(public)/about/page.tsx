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
    <div className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
      <p className="text-eyebrow">About</p>
      <h1 className="text-display mt-3">About Xarvisrobo</h1>

      <div className="mt-16 space-y-16">
        {SECTIONS.map((section, i) => (
          <section
            key={section.heading}
            className={i > 0 ? "border-t border-neutral-200 pt-16" : undefined}
          >
            <h2 className="text-h2">{section.heading}</h2>
            <p className="mt-5 text-lg leading-relaxed text-neutral-700">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
