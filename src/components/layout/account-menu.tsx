"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/components/layout/sign-out-action";

// Logged-in customer menu in the site header. Client component because
// Radix dropdowns need interactivity; the session data (name) is resolved
// by the server-rendered header and passed down as a plain prop.
export function AccountMenu({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors duration-200 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
        {name}
        <ChevronDown className="size-4" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuLabel className="text-neutral-500 font-normal">
          Signed in as {name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User strokeWidth={1.5} />
            My Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOutAction();
          }}
        >
          <LogOut strokeWidth={1.5} />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
