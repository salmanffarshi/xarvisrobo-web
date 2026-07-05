// Guest-cart merge on login/register (Phase C.1). Called client-side right
// after signIn resolves ok, before the redirect — the session cookie is
// already set, so /api/v1/cart/merge authenticates. Best-effort by design:
// a merge failure must never block a successful login, so errors are logged
// and swallowed (the guest cart stays in localStorage for a later retry).

import { clearGuestCart, readGuestCart } from "@/lib/cart/guest-cart";

export async function mergeGuestCartOnAuth(): Promise<void> {
  try {
    const items = readGuestCart();
    if (items.length === 0) return;

    const res = await fetch("/api/v1/cart/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      throw new Error(`merge responded ${res.status}`);
    }

    clearGuestCart();
  } catch (error) {
    console.error("Guest cart merge failed (login continues):", error);
  }
}
