// Contact message business logic (ADR-003: services own the rules; the API
// route is HTTP glue only). The future mobile app reuses this behavior by
// hitting the same POST /api/v1/contact endpoint.
//
// NOTE: No email notification here on purpose — Resend is wired in Phase F.

import { db } from "@/lib/db";
import {
  contactMessageSchema,
  type ContactMessageInput,
} from "@/lib/validations/contact";

/** Thrown when the basic spam heuristics reject a submission. */
export class SpamRejectedError extends Error {
  constructor() {
    super("Message rejected by spam filter");
    this.name = "SpamRejectedError";
  }
}

/** Matches URLs for the spam heuristic (http(s):// or www.-prefixed). */
const URL_PATTERN = /(https?:\/\/|www\.)/gi;

export async function submitMessage(
  input: ContactMessageInput
): Promise<{ id: string }> {
  // Defense in depth: re-parse even though the route already validated.
  // Services must never trust their callers (the mobile app will call the
  // same endpoint, and future routes might forget to validate).
  const data = contactMessageSchema.parse(input);

  // Basic spam guards. Deliberately crude — real rate limiting by IP is an
  // infrastructure concern handled at the route/middleware layer later.
  const urlCount = (data.message.match(URL_PATTERN) ?? []).length;
  if (urlCount >= 5) {
    throw new SpamRejectedError();
  }
  if (data.name.toLowerCase() === data.email) {
    // Bots frequently stuff the same value into every field; a human's
    // display name is never literally their email address.
    throw new SpamRejectedError();
  }

  const created = await db.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      subject: data.subject,
      message: data.message,
      isResolved: false,
    },
    select: { id: true },
  });

  return { id: created.id };
}
