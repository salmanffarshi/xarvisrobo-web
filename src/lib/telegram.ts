import "server-only";

import { RETRY_DELAYS_MS, sleep } from "@/lib/retry";

// Admin Telegram alerts (Phase I). This is the ONE place the Telegram Bot API is
// touched — the notification service sends admin alerts (new order, payment-proof
// submitted) through sendTelegram().
//
// server-only: importing this from a client component is a build error, so the
// TELEGRAM_BOT_TOKEN can never be bundled into client JS.
//
// Best-effort, like the email client: sendTelegram never throws and never returns
// provider error details to the caller. A missing token/chat id is a no-op with a
// warning (dev without Telegram configured must not crash the order operation).
// The env is read at call time (not module load) so importing this file is safe
// in an environment that happens not to have the vars set.

export interface SendTelegramResult {
  ok: boolean;
}

/**
 * Send one message to the admin Telegram chat. parse_mode is HTML — callers must
 * HTML-escape any user-supplied text they interpolate. Returns { ok }; failures
 * are logged server-side and swallowed.
 */
export async function sendTelegram(text: string): Promise<SendTelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — message not sent.",
    );
    return { ok: false };
  }

  // Bounded retry (RETRY_DELAYS_MS.length retries → 3 attempts) for transient
  // transport failures (thrown network errors, 5xx) only — a 4xx (bad chat id,
  // rate limit) is permanent and not retried. Still best-effort: every path
  // returns { ok } and never throws.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const isLast = attempt === RETRY_DELAYS_MS.length;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
          }),
        },
      );

      if (res.ok) {
        return { ok: true };
      }

      // Telegram returns a JSON body with a description on failure; log it but
      // tell the caller only ok:false.
      const detail = await res.text().catch(() => "");

      // 4xx is permanent (bad chat id, rate limit) — do not retry. Only 5xx is
      // transient.
      if (res.status < 500) {
        console.error("[telegram] send failed:", res.status, detail);
        return { ok: false };
      }
      if (isLast) {
        console.error("[telegram] send failed after retries:", res.status, detail);
        return { ok: false };
      }
      console.warn(
        `[telegram] transient ${res.status} (attempt ${attempt + 1}), retrying:`,
        detail,
      );
    } catch (err) {
      // A thrown error is a network/transport failure — transient.
      if (isLast) {
        console.error("[telegram] send threw after retries:", err);
        return { ok: false };
      }
      console.warn(`[telegram] send threw (attempt ${attempt + 1}), retrying:`, err);
    }
    // Only reached on a transient failure with attempts remaining, so the index
    // is always in range; `?? 0` just satisfies noUncheckedIndexedAccess.
    await sleep(RETRY_DELAYS_MS[attempt] ?? 0);
  }

  // Unreachable — the final attempt always returns above.
  return { ok: false };
}
