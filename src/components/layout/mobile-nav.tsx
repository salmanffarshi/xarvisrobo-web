"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/components/layout/sign-out-action";
import { NAV_LINKS } from "@/components/layout/nav-links";

// What the server-rendered header resolved about the current session.
// Plain serializable data — client components can't call auth() themselves.
export type HeaderAuthState =
  | { status: "guest" }
  | { status: "customer"; name: string }
  | { status: "staff" };

// Mobile hamburger + slide-in drawer. Links close the sheet on tap
// (controlled open state) so navigation feels immediate.
export function MobileNav({ authState }: { authState: HeaderAuthState }) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="rounded-xl p-2 text-neutral-600 transition-colors duration-200 hover:text-neutral-900 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-6" strokeWidth={1.5} />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 bg-white shadow-none">
        <SheetHeader>
          <SheetTitle className="tracking-tight text-neutral-900">
            Xarvisrobo
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="rounded-xl px-3 py-2.5 text-base text-neutral-600 transition-colors duration-200 hover:bg-neutral-50 hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Separator className="mx-4 w-auto bg-neutral-100" />

        <div className="flex flex-col gap-2 px-4 pb-6">
          {authState.status === "guest" && (
            <>
              <Button
                asChild
                className="rounded-full"
                onClick={close}
              >
                <Link href="/register">Get early access</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-xl text-neutral-600"
                onClick={close}
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
          {authState.status === "customer" && (
            <>
              <Button
                asChild
                variant="ghost"
                className="justify-start rounded-xl text-neutral-600"
                onClick={close}
              >
                <Link href="/account">My Account</Link>
              </Button>
              <Button
                variant="ghost"
                className="justify-start rounded-xl text-neutral-600"
                onClick={() => {
                  close();
                  void signOutAction();
                }}
              >
                Sign Out
              </Button>
            </>
          )}
          {authState.status === "staff" && (
            <Button asChild className="rounded-full" onClick={close}>
              <Link href="/admin">Admin Panel</Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
