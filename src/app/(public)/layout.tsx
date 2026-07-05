import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartProviderServer } from "@/components/cart/cart-provider-server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Public shell — wraps all marketing/catalog pages with the real site chrome.
// Auth pages, the customer area, and admin keep their own layouts.
// CartProviderServer wraps the whole shell so the header badge, the drawer,
// and every catalog page share one cart state (guest or user).
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProviderServer>
      <div className="flex min-h-screen flex-col bg-white text-neutral-900 antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <CartDrawer />
    </CartProviderServer>
  );
}
