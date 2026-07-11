"use client";

// The admin sidebar nav link list. A client component because it reads the
// current path (usePathname) + query (useSearchParams) to highlight the active
// item. Reused in both the desktop sidebar and the mobile Sheet; `onNavigate`
// lets the Sheet close itself when a link is tapped. E.2.1 adds Orders + the
// Payments queue (a pre-filtered view of the same order list).

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Factory,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// The status the Payments queue pre-filters to — the payment-verification
// queue. Shared so the nav's active-state check and the link agree.
const PAYMENTS_STATUS = "WAITING_FOR_PAYMENT_VERIFICATION";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // How to decide the active state from the current path + query.
  isActive: (pathname: string, status: string | null) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === "/admin",
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
    // Any order view EXCEPT the Payments-queue filter (which owns its own item).
    isActive: (pathname, status) =>
      pathname.startsWith("/admin/orders") && status !== PAYMENTS_STATUS,
  },
  {
    label: "Payments",
    href: `/admin/orders?status=${PAYMENTS_STATUS}`,
    icon: CreditCard,
    isActive: (pathname, status) =>
      pathname.startsWith("/admin/orders") && status === PAYMENTS_STATUS,
  },
  {
    label: "Manufacturing",
    href: "/admin/manufacturing",
    icon: Factory,
    isActive: (pathname) => pathname.startsWith("/admin/manufacturing"),
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/admin/settings"),
  },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const status = useSearchParams().get("status");

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ label, href, icon: Icon, isActive }) => {
        const active = isActive(pathname, status);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
