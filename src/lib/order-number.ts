// Order number candidate generator (Phase C.2).
//
// Format: XR-YYYYMMDD-XXXXX, e.g. XR-20260706-K7M2Q.
// The 5-char suffix is drawn from a reduced alphabet that excludes 0/O/1/I/L
// so the number is unambiguous when read over the phone.
//
// This module only produces a *candidate*. Uniqueness is enforced by the DB
// unique constraint on Order.orderNumber; the order service retries with a
// fresh candidate on collision (max 6 attempts). No counter table.

import { randomInt } from "node:crypto";

const SUFFIX_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 5;

// The date part reflects the business day in Bangladesh, not the server's
// timezone (Vercel runs on UTC — without this, orders placed before 6 AM
// Dhaka time would carry yesterday's date).
const dhakaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function generateOrderNumber(): string {
  // en-CA formats as YYYY-MM-DD; strip the dashes for YYYYMMDD.
  const datePart = dhakaDate.format(new Date()).replaceAll("-", "");

  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }

  return `XR-${datePart}-${suffix}`;
}
