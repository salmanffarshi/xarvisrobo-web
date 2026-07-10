"use client";

// Mobile-only top bar (admin is desktop-first but must not break on small
// screens). A menu button opens the sidebar nav in a left Sheet. Client because
// the Sheet's open/close is local state. The `footer` (signed-in name + role +
// sign-out) is rendered by the server layout and passed in as a node, so the
// sign-out server action never has to cross into this client component.

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminNav } from "./admin-nav";

export function AdminMobileBar({ footer }: { footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
      <span className="font-semibold tracking-tight">Xarvisrobo Admin</span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="size-5" strokeWidth={1.5} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="border-b px-5 py-4 text-base font-semibold tracking-tight">
            Xarvisrobo Admin
          </SheetTitle>
          <div className="flex-1 overflow-y-auto p-3">
            <AdminNav onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t">{footer}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
