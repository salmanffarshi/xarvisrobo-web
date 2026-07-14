import "server-only";

import { Resend } from "resend";

import { RETRY_DELAYS_MS, sleep } from "@/lib/retry";

// Reusable transactional-email helper. This is the ONE place the Resend SDK is
// touched — Phase I (order notifications) sends through sendEmail() too, so the
// API key, From address, and failure handling live here once.
//
// server-only: importing this from a client component is a build error, so the
// RESEND_API_KEY can never be bundled into client JS.

// From address. In dev, Resend only delivers from its shared `onboarding@resend.dev`
// sender (and only to the account owner's own email) until a domain is verified
// in Phase J — so that is the default. Override with RESEND_FROM once the real
// sending domain is live.
const FROM = process.env.RESEND_FROM ?? "Xarvisrobo <onboarding@resend.dev>";

// A single shared client. `RESEND_API_KEY` is validated as present at call time
// (see sendEmail) rather than at module load, so importing this file never
// throws in an environment that happens not to have the key.
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
}

// Resend error names that indicate a TRANSIENT failure worth retrying:
// `application_error` is what the SDK surfaces for undici network/transport resets
// (the broken-IPv6-egress case that motivated this retry); `internal_server_error`
// is a Resend 5xx. Everything else — bad address, unverified domain, missing field,
// `rate_limit_exceeded` — is a permanent 4xx we do NOT retry.
const TRANSIENT_RESEND_ERRORS = new Set([
  "application_error",
  "internal_server_error",
]);

/**
 * Send one transactional email. Returns { ok } — never throws and never returns
 * provider error details to the caller, so a caller (e.g. the password-reset
 * service) cannot leak "this email exists / the send failed" back to the user.
 * Failures are logged server-side for debugging.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY is not set — email not sent.");
    return { ok: false };
  }

  // Bounded retry (RETRY_DELAYS_MS.length retries → 3 attempts) for transient
  // transport failures only. Still best-effort: every path returns { ok } and
  // never throws, so a caller can `void sendEmail(...)` with no risk.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const isLast = attempt === RETRY_DELAYS_MS.length;
    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        // The Resend SDK types `text` as required-when-present; only pass it when
        // the caller supplied one.
        ...(input.text ? { text: input.text } : {}),
      });

      if (!error) {
        return { ok: true };
      }

      // Permanent error (bad address, unverified domain, rate limit, …) — never
      // retry; retrying can't help and would waste the rate-limit budget.
      if (!TRANSIENT_RESEND_ERRORS.has(error.name)) {
        console.error("[email] send failed:", error.name, error.message);
        return { ok: false };
      }
      if (isLast) {
        console.error("[email] send failed after retries:", error.name, error.message);
        return { ok: false };
      }
      console.warn(
        `[email] transient send failure (attempt ${attempt + 1}), retrying:`,
        error.name,
        error.message,
      );
    } catch (err) {
      // A thrown error is a network/transport failure — transient.
      if (isLast) {
        console.error("[email] send threw after retries:", err);
        return { ok: false };
      }
      console.warn(`[email] send threw (attempt ${attempt + 1}), retrying:`, err);
    }
    // Only reached on a transient failure with attempts remaining, so the index
    // is always in range; `?? 0` just satisfies noUncheckedIndexedAccess.
    await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
  }

  // Unreachable — the final attempt always returns above.
  return { ok: false };
}
