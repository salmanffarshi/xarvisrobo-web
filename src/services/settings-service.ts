// Store settings (Phase E.4 Part A, ADR-003). DB-backed, admin-editable source
// of truth for payment-receiving details, the WhatsApp handoff number, and the
// two COD delivery charges. The delivery-charge LOGIC stays in code (ADR-016 /
// src/lib/delivery.ts); only the two whole-taka NUMBERS live in this row.
//
// Exactly one row (id="singleton"). getSettings() creates it from the config
// defaults if it is somehow absent, so callers never have to handle a missing
// row.

import type { Settings } from "@prisma/client";

import {
  COD_DELIVERY_INSIDE_DHAKA,
  COD_DELIVERY_OUTSIDE_DHAKA,
  WHATSAPP_NUMBER,
  paymentGeneralNote,
  paymentReceivingDetails,
} from "@/config/payment";
import { db } from "@/lib/db";
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from "@/lib/validations/settings";

const SINGLETON_ID = "singleton";

/** Config-derived defaults — used only to self-heal a missing singleton. */
const defaults = {
  bkashNumber: paymentReceivingDetails.BKASH.number,
  bkashType: paymentReceivingDetails.BKASH.accountType,
  bkashInstructions: paymentReceivingDetails.BKASH.instructions ?? null,
  nagadNumber: paymentReceivingDetails.NAGAD.number,
  nagadType: paymentReceivingDetails.NAGAD.accountType,
  nagadInstructions: paymentReceivingDetails.NAGAD.instructions ?? null,
  whatsappNumber: WHATSAPP_NUMBER,
  messengerUrl: null,
  codInsideDhaka: COD_DELIVERY_INSIDE_DHAKA,
  codOutsideDhaka: COD_DELIVERY_OUTSIDE_DHAKA,
  paymentGeneralNote,
};

/**
 * The store settings singleton. Creates it from config defaults if absent
 * (defensive — the seed normally creates it), so every reader gets a row.
 */
export async function getSettings(): Promise<Settings> {
  return db.settings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...defaults },
    update: {},
  });
}

/**
 * Update the settings singleton. `adminId` is the acting staff id (the route
 * has already staff-guarded the request); Settings carries no author column, so
 * it is not persisted. Input is validated at this boundary before the write.
 */
export async function updateSettings(
  adminId: string,
  input: UpdateSettingsInput,
): Promise<Settings> {
  const data = updateSettingsSchema.parse(input);

  return db.settings.update({
    where: { id: SINGLETON_ID },
    data,
  });
}
