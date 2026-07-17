import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about early access, partnerships, media, or anything else — send Xarvisrobo a note.",
  openGraph: {
    title: "Contact | Xarvisrobo",
    description:
      "Questions about early access, partnerships, media, or anything else — send Xarvisrobo a note.",
    url: "/contact",
    siteName: "Xarvisrobo",
    locale: "en_US",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <p className="text-eyebrow">Contact</p>
      <h1 className="text-display mt-3 max-w-3xl">
        We&rsquo;d love to hear from you.
      </h1>
      <p className="text-lead mt-4 max-w-2xl">
        Questions about early access, partnerships, media, or anything else —
        send us a note.
      </p>

      <div className="mt-16 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactForm />
        </div>

        <aside className="h-fit rounded-2xl border border-neutral-200/70 bg-neutral-50 p-8 shadow-soft">
          <dl className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <Mail
                className="mt-0.5 size-5 shrink-0 text-neutral-400"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <dt className="text-sm font-medium text-neutral-900">Email</dt>
                {/* PLACEHOLDER EMAIL — replace with the real company inbox
                    before public launch (domain not yet registered). */}
                <dd className="mt-1 text-sm text-neutral-600">
                  hello@xarvisrobo.com
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin
                className="mt-0.5 size-5 shrink-0 text-neutral-400"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <dt className="text-sm font-medium text-neutral-900">
                  Location
                </dt>
                <dd className="mt-1 text-sm text-neutral-600">
                  Dhaka, Bangladesh
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock
                className="mt-0.5 size-5 shrink-0 text-neutral-400"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <dt className="text-sm font-medium text-neutral-900">
                  Reply time
                </dt>
                <dd className="mt-1 text-sm text-neutral-600">
                  We reply within two business days.
                </dd>
              </div>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
