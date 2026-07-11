"use client";

// Customer list search box (URL-as-state, debounced). Pushes ?search= to the
// router; the /admin/customers server component re-renders with fresh data.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

export function CustomerSearch({ search }: { search?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(search ?? "");
  const urlSearch = search ?? "";

  React.useEffect(() => {
    setValue(urlSearch);
  }, [urlSearch]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed !== urlSearch) {
        const qs = trimmed ? `?search=${encodeURIComponent(trimmed)}` : "";
        router.push(`/admin/customers${qs}`, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        type="search"
        placeholder="Search name, email, or phone…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="sm:max-w-sm"
        aria-label="Search customers"
      />
      {urlSearch && (
        <Link
          href="/admin/customers"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Clear
        </Link>
      )}
    </div>
  );
}
