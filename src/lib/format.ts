/**
 * "2999.00" → "৳2,999". Prices are strings on the wire (money convention);
 * Number() here is display-only, never arithmetic.
 */
export function formatBdt(amount: string): string {
  return `৳${Number(amount).toLocaleString("en-BD")}`;
}
