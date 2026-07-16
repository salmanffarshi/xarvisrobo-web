import "server-only";

// Server error alerting via Telegram (Phase J.3 Part D).
//
// Wired from `src/instrumentation.ts`'s `onRequestError` hook (Next 15), which
// fires for any unhandled server-side error (route handlers, RSC render, server
// actions). We send a compact Telegram alert so an outage is noticed fast.
//
// THROTTLED — mandatory. A storm (the same error 500×/min) must produce ~1
// message, not 500. We dedupe by an error SIGNATURE (route + error type +
// message, hashed) and send at most one alert per signature per 15 minutes,
// carrying a count of how many occurrences were suppressed since the last send.
// The throttle reuses the Part A `RateLimit` table.
//
// BEST-EFFORT — like the Phase I notifications: this never throws and never
// affects the response. A missing Telegram token or a DB blip degrades to
// "no alert", never to a broken request.
//
// PRIVACY — the alert carries ONLY: route pattern/path, HTTP method, error type
// + message, a short stack excerpt, and a timestamp. It NEVER includes request
// bodies, headers, cookies, session tokens, query strings, or customer PII.

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { sendTelegram } from "@/lib/telegram";

const THROTTLE_WINDOW_SECONDS = 15 * 60; // one alert per signature per 15 min
const MAX_MESSAGE_LEN = 300;
const MAX_STACK_LEN = 500;

export interface ServerErrorMeta {
  // The route PATTERN (e.g. /api/v1/me/orders/[orderNumber]) when available —
  // preferred over the concrete path so we never leak ids. Falls back to the
  // concrete path with any query string stripped.
  routePath?: string;
  path: string;
  method: string;
  routeType?: string;
}

interface ThrottleResult {
  send: boolean;
  suppressed: number;
}

// Escape the five HTML-significant characters (sendTelegram uses parse_mode
// HTML, so any interpolated text must be escaped).
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip a query string (it can carry sensitive values) and cap length.
function safePath(path: string): string {
  const noQuery = path.split("?")[0] ?? path;
  return noQuery.slice(0, 200);
}

/**
 * Atomically decide whether to alert for `signature` now. Returns
 * `{ send, suppressed }`: `send` is true at most once per 15-minute window per
 * signature; `suppressed` is the number of occurrences that were swallowed
 * since the previous send (0 on the first). Best-effort — on any DB error it
 * returns `{ send: true, suppressed: 0 }` (fail toward alerting, since a
 * genuine outage should not be silenced by a limiter blip). Rare double-sends
 * at a window boundary under a storm are acceptable.
 */
async function throttleErrorAlert(signature: string): Promise<ThrottleResult> {
  const key = `erralert:${signature}`;
  const now = new Date();
  try {
    // Increment occurrences atomically. The row's expiresAt marks the moment we
    // are next allowed to send; a brand-new row is inserted with expiresAt=now
    // so the very first occurrence sends immediately.
    const rows = await db.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count", "expiresAt"
    `;
    const row = rows[0];
    if (!row) return { send: true, suppressed: 0 };

    // May we send? (throttle window has elapsed)
    if (now.getTime() >= row.expiresAt.getTime()) {
      // Claim the send and open a fresh window; reset the occurrence counter.
      const next = new Date(now.getTime() + THROTTLE_WINDOW_SECONDS * 1000);
      await db.$executeRaw`
        UPDATE "RateLimit" SET "count" = 0, "expiresAt" = ${next} WHERE "key" = ${key}
      `;
      // Occurrences since the last send that we did not alert on = count - 1
      // (this occurrence is the one we're sending for).
      return { send: true, suppressed: Math.max(0, row.count - 1) };
    }
    // Within the window — suppress.
    return { send: false, suppressed: 0 };
  } catch (error) {
    console.error("[error-alert] throttle failed — alerting anyway:", error);
    return { send: true, suppressed: 0 };
  }
}

/**
 * Report a server-side error to the admin Telegram, throttled and best-effort.
 * Never throws. Call it fire-and-forget (or await it inside `after()`); it does
 * not touch the response.
 */
export async function reportServerError(
  error: unknown,
  meta: ServerErrorMeta,
): Promise<void> {
  try {
    const err = error instanceof Error ? error : undefined;
    const errorType = err?.name ?? "Error";
    const rawMessage =
      err?.message ?? (typeof error === "string" ? error : "Unknown error");
    const message = rawMessage.slice(0, MAX_MESSAGE_LEN);
    const route = meta.routePath ?? safePath(meta.path);

    // Signature = route + type + message → hash. Same error on the same route
    // collapses to one alert per window regardless of concrete path/ids.
    const signature = createHash("sha1")
      .update(`${route}|${errorType}|${message}`)
      .digest("hex")
      .slice(0, 16);

    const { send, suppressed } = await throttleErrorAlert(signature);
    if (!send) return;

    // Short stack excerpt (first few frames), capped.
    const stackExcerpt = err?.stack
      ? err.stack.split("\n").slice(1, 5).join("\n").slice(0, MAX_STACK_LEN)
      : "";

    const lines = [
      "🚨 <b>Xarvisrobo server error</b>",
      `<b>Route:</b> ${escapeHtml(route)}`,
      `<b>Method:</b> ${escapeHtml(meta.method)}${
        meta.routeType ? ` (${escapeHtml(meta.routeType)})` : ""
      }`,
      `<b>Type:</b> ${escapeHtml(errorType)}`,
      `<b>Message:</b> ${escapeHtml(message)}`,
    ];
    if (stackExcerpt) {
      lines.push(`<b>Stack:</b>\n<pre>${escapeHtml(stackExcerpt)}</pre>`);
    }
    if (suppressed > 0) {
      lines.push(
        `<i>+${suppressed} more of this error suppressed in the last 15 min</i>`,
      );
    }
    lines.push(`<b>At:</b> ${new Date().toISOString()}`);

    await sendTelegram(lines.join("\n"));
  } catch (alertError) {
    // Absolutely never let alerting affect anything.
    console.error("[error-alert] reporting failed:", alertError);
  }
}
