import "server-only";

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

    if (!res.ok) {
      // Telegram returns a JSON body with a description on failure; log it but
      // tell the caller only ok:false.
      const detail = await res.text().catch(() => "");
      console.error("[telegram] send failed:", res.status, detail);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    // Network or unexpected error. Log, return ok:false, never throw.
    console.error("[telegram] send threw:", err);
    return { ok: false };
  }
}
