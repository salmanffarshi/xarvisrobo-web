// Server half of the cart provider (Phase C.1). Reads the session once per
// request and, for signed-in customers, loads the DB cart server-side so the
// first paint already shows the right items — no client fetch flash. Guests
// (and staff, who don't shop) get a null cart and hydrate from localStorage
// client-side.

import { auth } from "@/auth";
import { isCustomer } from "@/lib/permissions";
import { getCart } from "@/services/cart-service";
import { CartProvider } from "@/components/cart/cart-provider";

export async function CartProviderServer({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isCustomerSession =
    !!session?.user && isCustomer(session.user.role);

  const initialCart = isCustomerSession
    ? await getCart(session.user.id)
    : null;

  return (
    <CartProvider isAuthenticated={isCustomerSession} initialCart={initialCart}>
      {children}
    </CartProvider>
  );
}
