import "server-only";

// Postgres-backed fixed-window rate limiting (Phase J.3 Part A).
//
// ALGORITHM — fixed window, chosen for simplicity and race-safety. Each `key`
// owns one `RateLimit` row holding a `count` and the window's `expiresAt`. A
// request increments `count`; when `count` exceeds `limit`, the request is
// denied until `expiresAt` passes and the window resets. Fixed window can allow
// up to ~2× the limit across a window boundary (a burst at the tail of one
// window plus a burst at the head of the next); that is an accepted, well-known
// trade-off — sliding-window/token-bucket add materially more complexity for a
// launch whose goal is stopping brute-force and abuse, not precise metering.
//
// ATOMICITY — the increment is a SINGLE `INSERT … ON CONFLICT DO UPDATE`
// executed as raw SQL, so two concurrent requests can never both read a stale
// count and slip past the limit (the classic read-then-write race). The row is
// created-or-incremented and the NEW count is returned in one round-trip. The
// window reset is folded into the same statement via a CASE: if the stored
// window has expired, the update resets `count` to 1 and stamps a fresh
// `expiresAt`; otherwise it increments and keeps the existing `expiresAt`.
//
// FAIL-OPEN — every DB interaction is wrapped so that a limiter failure (a Neon
// blip, a pool timeout) ALLOWS the request and logs, rather than locking
// everyone out. A rate limiter must never become the outage.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface CheckRateLimitInput {
  key: string;
  limit: number;
  windowSeconds: number;
}

// A single row of the atomic upsert result.
interface UpsertRow {
  count: number;
  expiresAt: Date;
}

/**
 * Atomically record one hit against `key` and report whether it is within
 * `limit` for the current `windowSeconds` window.
 *
 * Returns `{ ok, remaining, retryAfterSeconds }`. On ANY database error this
 * FAILS OPEN — returns `ok: true` with `remaining: limit` — and logs; a limiter
 * outage must not become a site outage.
 */
export async function checkRateLimit({
  key,
  limit,
  windowSeconds,
}: CheckRateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = windowSeconds * 1000;
  const freshExpiry = new Date(now.getTime() + windowMs);

  try {
    // INSERT the first hit, or on key conflict UPDATE atomically:
    //   - if the stored window has expired  → reset (count = 1, new expiry)
    //   - otherwise                         → count = count + 1 (keep expiry)
    // RETURNING gives us the post-write count + the window end in one round-trip.
    const rows = await db.$queryRaw<UpsertRow[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${freshExpiry})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."expiresAt" <= ${now} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" <= ${now} THEN ${freshExpiry}
          ELSE "RateLimit"."expiresAt"
        END
      RETURNING "count", "expiresAt"
    `;

    const row = rows[0];
    if (!row) {
      // Should never happen (INSERT/UPDATE always returns a row) — fail open.
      return { ok: true, remaining: limit, retryAfterSeconds: 0 };
    }

    const count = row.count;
    const expiresAt = row.expiresAt;
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000),
    );

    if (count > limit) {
      return { ok: false, remaining: 0, retryAfterSeconds };
    }

    return {
      ok: true,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: 0,
    };
  } catch (error) {
    // FAIL OPEN: a limiter DB error must never block a legitimate request.
    console.error(`[rate-limit] check failed for "${key}" — allowing:`, error);
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/**
 * Read the current state of `key` WITHOUT incrementing. Used by the login
 * wrapper to reject an already-over-limit attempt before it ever reaches
 * Auth.js, so that only genuine (failed) attempts are recorded via
 * `checkRateLimit`. Fails open (`ok: true`) on any DB error.
 */
export async function peekRateLimit({
  key,
  limit,
}: CheckRateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  try {
    const rows = await db.$queryRaw<UpsertRow[]>`
      SELECT "count", "expiresAt" FROM "RateLimit" WHERE "key" = ${key}
    `;
    const row = rows[0];

    // No row, or an expired window → the next attempt starts a fresh window.
    if (!row || row.expiresAt.getTime() <= now.getTime()) {
      return { ok: true, remaining: limit, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000),
    );

    if (row.count >= limit) {
      return { ok: false, remaining: 0, retryAfterSeconds };
    }
    return {
      ok: true,
      remaining: Math.max(0, limit - row.count),
      retryAfterSeconds: 0,
    };
  } catch (error) {
    console.error(`[rate-limit] peek failed for "${key}" — allowing:`, error);
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

// Header Auth.js/Next sees for the real client IP on Vercel. Vercel populates
// `x-forwarded-for` with the client IP as the LEFTMOST entry (it appends its own
// hops after), and also sets `x-real-ip` to that same client IP. We prefer
// x-forwarded-for's first entry and fall back to x-real-ip. Locally (no proxy)
// both may be absent, so we fall back to a constant bucket.
const FALLBACK_IP = "unknown";

/**
 * Extract the real client IP from a request's headers, for use as a rate-limit
 * key. Falls back to a constant when no IP header is present (e.g. local dev)
 * so the key is always stable — never throws.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // "client, proxy1, proxy2" → the client is the first entry.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return FALLBACK_IP;
}

// Opportunistic cleanup: delete a small, bounded batch of expired rows so the
// table can't grow without bound. Kept cheap (LIMIT 100, indexed on expiresAt)
// and fire-and-forget from a random fraction of requests, so it adds no
// meaningful latency and never blocks the caller. Best-effort — swallows errors.
const CLEANUP_BATCH = 100;
const CLEANUP_PROBABILITY = 0.01; // ~1% of rate-limited requests trigger a sweep

/**
 * With small probability, delete a bounded batch of expired rate-limit rows.
 * Call it fire-and-forget (`void maybeCleanupRateLimits()`); it awaits nothing
 * on the hot path and never throws.
 */
export function maybeCleanupRateLimits(): void {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  void (async () => {
    try {
      await db.$executeRaw`
        DELETE FROM "RateLimit"
        WHERE "key" IN (
          SELECT "key" FROM "RateLimit"
          WHERE "expiresAt" <= ${new Date()}
          LIMIT ${CLEANUP_BATCH}
        )
      `;
    } catch (error) {
      console.error("[rate-limit] cleanup sweep failed:", error);
    }
  })();
}

// ── Route-facing helper ──────────────────────────────────────────────────────
//
// Central catalogue of the per-endpoint window sizes + limits (Phase J.3 A3).
// Generous for humans, tight on abuse. Kept in one place so the limits are
// auditable at a glance and easy to tune without hunting through routes.
const HOUR = 3600;
const MIN_15 = 15 * 60;

export const RATE_LIMITS = {
  adminLogin: { limit: 5, windowSeconds: MIN_15 },
  customerLogin: { limit: 10, windowSeconds: MIN_15 },
  register: { limit: 5, windowSeconds: HOUR },
  forgotPassword: { limit: 3, windowSeconds: HOUR },
  resetPassword: { limit: 10, windowSeconds: HOUR },
  couponValidate: { limit: 20, windowSeconds: HOUR },
  contact: { limit: 5, windowSeconds: HOUR },
  paymentProof: { limit: 10, windowSeconds: HOUR },
  cloudinarySign: { limit: 30, windowSeconds: HOUR },
} as const;

// Generic 429 body — never reveals whether an account/coupon/email exists.
const TOO_MANY_MESSAGE = "Too many requests. Please try again later.";

/**
 * Build a standard 429 response with a `Retry-After` header (seconds) and the
 * generic error envelope. `retryAfterSeconds` comes from the failing check.
 */
export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: TOO_MANY_MESSAGE } },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    },
  );
}

/**
 * Run every supplied rate-limit check (ALL must pass — used for the dual
 * ip+email keys on forgot-password). If any is over its limit, return a ready
 * 429 `NextResponse`; otherwise return `null` and let the handler proceed.
 * Fires an opportunistic cleanup sweep. The two-line usage in a route is:
 *
 *   const limited = await enforceRateLimits([{ key, ...RATE_LIMITS.contact }]);
 *   if (limited) return limited;
 */
export async function enforceRateLimits(
  checks: CheckRateLimitInput[],
): Promise<NextResponse | null> {
  maybeCleanupRateLimits();
  const results = await Promise.all(checks.map((c) => checkRateLimit(c)));
  const blocked = results.find((r) => !r.ok);
  if (blocked) {
    return tooManyRequests(blocked.retryAfterSeconds);
  }
  return null;
}
