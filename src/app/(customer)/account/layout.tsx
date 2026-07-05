// Account section chrome (Phase B.3). The parent (customer)/layout.tsx already
// guards auth (redirects non-customers to /login), so this nested layout only
// adds the section shell: a sticky sidebar nav on lg+ screens, a horizontal
// tab bar on mobile, with the page content beside/below it.

import { AccountNav } from "@/components/account/account-nav";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:py-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <aside className="-mx-6 border-b border-neutral-200 px-6 pb-3 lg:m-0 lg:w-56 lg:shrink-0 lg:border-0 lg:p-0">
          {/* Sticky so the nav stays visible while long pages scroll. */}
          <div className="lg:sticky lg:top-8">
            <AccountNav />
          </div>
        </aside>
        {/* min-w-0 lets the content column shrink instead of overflowing. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
