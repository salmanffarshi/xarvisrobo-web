/**
 * "2999.00" → "৳2,999". Prices are strings on the wire (money convention);
 * Number() here is display-only, never arithmetic.
 *
 * en-US grouping (24500 → "24,500"), not en-BD lakh grouping — en-BD output
 * differs between Node/browser ICU builds, and mixed grouping styles across
 * server and client would cause hydration mismatches.
 */
export function formatBdt(amount: string): string {
  return `৳${Number(amount).toLocaleString("en-US")}`;
}
