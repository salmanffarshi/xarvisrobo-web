"use client";

// Desktop primary nav links with active-state highlighting. A tiny client
// island (reads usePathname) so the surrounding SiteHeader can stay a server
// component. Shares NAV_LINKS with the mobile sheet so they never drift.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/components/layout/nav-links";

export function HeaderNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-8 md:flex">
      {NAV_LINKS.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-sm transition-colors duration-200",
              isActive
                ? "font-medium text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
