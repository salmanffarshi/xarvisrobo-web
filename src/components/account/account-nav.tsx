"use client";

// Account section navigation. Client component because it reads the current
// URL (usePathname) to highlight the active section — server components can't
// do that. Renders as a horizontal scrollable tab bar on mobile and a vertical
// sidebar list on lg+ screens (one markup, responsive classes).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Lock, LogOut, MapPin, Package, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOutAction } from "@/components/layout/sign-out-action";

const NAV_ITEMS = [
  // `exact` on Overview so /account/profile doesn't also light it up.
  { label: "Overview", href: "/account", icon: LayoutDashboard, exact: true },
  // startsWith (exact: false) keeps Orders lit on both the list and the
  // /account/orders/[orderNumber] detail page.
  {
    label: "Orders",
    href: "/account/orders",
    icon: Package,
    exact: false,
    strokeWidth: 1.5,
  },
  { label: "Profile", href: "/account/profile", icon: User, exact: false },
  { label: "Addresses", href: "/account/addresses", icon: MapPin, exact: false },
  {
    label: "Password",
    href: "/account/change-password",
    icon: Lock,
    exact: false,
  },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Account"
      className="flex items-center gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:overflow-visible"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact, strokeWidth }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-blue-50 text-blue-600"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <Icon className="size-4" strokeWidth={strokeWidth} />
            {label}
          </Link>
        );
      })}

      {/* Sign out — a server action (Auth.js signOut handles CSRF + cookie
          clearing), styled distinctly at the end of the list. */}
      <form
        action={signOutAction}
        className="shrink-0 lg:mt-4 lg:border-t lg:border-neutral-200 lg:pt-4"
      >
        <button
          type="submit"
          className="flex w-full shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </nav>
  );
}
