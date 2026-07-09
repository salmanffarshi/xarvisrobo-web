// Zod validation for order placement (Phase C.2).
//
// Deliberately contains NO price/subtotal/total fields — the client never
// sends money values. All totals are recomputed server-side from live DB
// prices at placement time (ADR-005).

import { z } from "zod";
import { phoneSchema } from "@/lib/validations/auth";

export const placeOrderSchema = z.object({
  addressId: z.string().cuid("Invalid address id"),
  contactPhone: phoneSchema,
  deliveryNotes: z
    .string()
    .trim()
    .max(1000, "Delivery notes must be 1000 characters or fewer")
    .optional(),
  paymentMethod: z.enum(["BKASH", "NAGAD", "COD"]),
  // Explicit customer radio at checkout — not derived from the address (ADR-016).
  deliveryZone: z.enum(["INSIDE_DHAKA", "OUTSIDE_DHAKA"]),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
