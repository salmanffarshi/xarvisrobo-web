// Single source of truth for the primary site navigation, shared by the
// desktop header nav and the mobile sheet so they can never drift apart.
// NOTE: /products will 404 until Phase B.2 ships the catalog — expected.
export const NAV_LINKS = [
  { href: "/products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/warranty", label: "Warranty" },
  { href: "/contact", label: "Contact" },
] as const;
