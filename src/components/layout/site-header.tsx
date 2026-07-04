import Link from "next/link";

import { auth } from "@/auth";
import { isCustomer } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/layout/account-menu";
import {
  MobileNav,
  type HeaderAuthState,
} from "@/components/layout/mobile-nav";
import { NAV_LINKS } from "@/components/layout/nav-links";

// Sticky glassmorphism header. Server component: it reads the session once
// per request via auth() (JWT decode, no DB hit — ADR-014) and passes plain
// data down to the interactive client pieces (dropdown, mobile sheet).
export async function SiteHeader() {
  const session = await auth();

  const authState: HeaderAuthState = !session?.user
    ? { status: "guest" }
    : isCustomer(session.user.role)
      ? { status: "customer", name: session.user.name ?? "Account" }
      : { status: "staff" };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-neutral-900"
        >
          Xarvisrobo
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-600 transition-colors duration-200 hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {authState.status === "guest" && (
            <>
              <Link
                href="/login"
                className="text-sm text-neutral-600 transition-colors duration-200 hover:text-neutral-900"
              >
                Sign in
              </Link>
              <Button asChild size="sm" className="rounded-full px-4">
                <Link href="/register">Get early access</Link>
              </Button>
            </>
          )}
          {authState.status === "customer" && (
            <AccountMenu name={authState.name} />
          )}
          {authState.status === "staff" && (
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href="/admin">Admin Panel</Link>
            </Button>
          )}
        </div>

        <MobileNav authState={authState} />
      </div>
    </header>
  );
}
