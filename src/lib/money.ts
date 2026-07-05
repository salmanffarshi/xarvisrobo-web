// Decimal money arithmetic (Phase C.1). Money travels as decimal-strings on
// the wire ("1250.00" — see docs/api-endpoints.md conventions); these helpers
// do the math without ever touching JS floats. Display formatting lives in
// src/lib/format.ts (formatBdt).

import Decimal from "decimal.js";

/** "24500.00" * 3 → "73500.00" */
export function multiplyMoney(amount: string, quantity: number): string {
  return new Decimal(amount).times(quantity).toFixed(2);
}

/** ["100.00", "250.50"] → "350.50". Empty array → "0.00". */
export function sumMoney(amounts: string[]): string {
  return amounts
    .reduce((total, amount) => total.plus(amount), new Decimal(0))
    .toFixed(2);
}
