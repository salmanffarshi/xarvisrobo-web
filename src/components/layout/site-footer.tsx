import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/products", label: "Robots" },
      { href: "/warranty", label: "Warranty" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
    ],
  },
] as const;

// Static site footer — server component, no interactivity.
export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-lg font-semibold tracking-tight text-neutral-900">
              Xarvisrobo
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600">
              Robots designed to belong on your desk.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="text-sm font-medium text-neutral-900">
                {column.heading}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-600 transition-colors duration-200 hover:text-neutral-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t border-neutral-200 pt-8">
          <p className="text-sm text-neutral-500">
            © 2026 Xarvisrobo. Designed and built in Bangladesh.
          </p>
        </div>
      </div>
    </footer>
  );
}
