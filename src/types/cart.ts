// Shared cart shapes (Phase C.1), used by the cart service, the /api/v1/cart
// responses, and the client cart provider. Money is decimal-as-string on the
// wire (per docs/api-endpoints.md conventions) — arithmetic via src/lib/money.

export type CartLineItem = {
  /** DB CartItem id; null for guest (localStorage) items. */
  itemId: string | null;
  productId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  /** Live Product.basePrice, decimal-as-string (ADR-015). */
  unitPrice: string;
  quantity: number;
  /** unitPrice * quantity, decimal-as-string. */
  lineTotal: string;
  /** false if the product was deactivated after being added. */
  isActive: boolean;
};

export type CartView = {
  items: CartLineItem[];
  /** Sum of ACTIVE line totals only, decimal-as-string. */
  subtotal: string;
  /** Sum of quantities across all lines. */
  itemCount: number;
  /** Number of distinct line items. */
  distinctCount: number;
};
