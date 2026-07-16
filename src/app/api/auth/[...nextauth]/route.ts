// Auth.js catch-all route handler.
//
// Auth.js needs HTTP endpoints for its internal flows (sign-in, sign-out,
// callbacks, CSRF token, session lookup). In the App Router we expose them by
// re-exporting the GET/POST handlers produced by the single instance in
// `src/auth.ts`. This lives at /api/auth/* (separate from our own /api/v1/*).
//
// RATE LIMITING (Phase J.3 Part A) — login is NOT a /api/v1 route; it flows
// through Auth.js's credentials callback here. So we wrap POST to enforce a real
// 429 on the two credentials callbacks (admin + customer). The design records
// only FAILED attempts: we PEEK the limit before delegating (blocking an already
// over-limit source with a 429 + Retry-After), then after Auth.js responds we
// INCREMENT the counters only if the attempt failed (no session cookie was set).
// A legitimate user's successful logins therefore never consume budget, while an
// attacker's failed guesses are capped. Everything is fail-open and defensive:
// any error in the wrapper falls through to the normal handler.

import { NextRequest } from "next/server";

import { handlers } from "@/auth";
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  peekRateLimit,
  tooManyRequests,
} from "@/lib/rate-limit";

export const { GET } = handlers;

// Provider id → the limit config + whether the email key applies. Admin login is
// keyed by BOTH ip and email (distributed brute-force + targeted lockout);
// customer login by ip only (higher limit, no per-email key by spec).
const LOGIN_LIMITS: Record<
  string,
  { config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]; byEmail: boolean }
> = {
  "admin-credentials": { config: RATE_LIMITS.adminLogin, byEmail: true },
  "customer-credentials": { config: RATE_LIMITS.customerLogin, byEmail: false },
};

// True when the Auth.js response set a non-empty session cookie — i.e. the
// credentials sign-in succeeded. A failed attempt sets no session token.
function loginSucceeded(res: Response): boolean {
  const cookies = res.headers.getSetCookie();
  // Matches authjs.session-token / __Secure-authjs.session-token (and the legacy
  // next-auth.* name) with a non-empty value (a cleared cookie has `=;`).
  return cookies.some((c) => /session-token=[^;\s]/.test(c));
}

export async function POST(req: NextRequest): Promise<Response> {
  const match = req.nextUrl.pathname.match(
    /\/api\/auth\/callback\/(admin-credentials|customer-credentials)$/,
  );

  // Not a credentials login callback → pass straight through.
  const provider = match?.[1];
  const entry = provider ? LOGIN_LIMITS[provider] : undefined;
  if (!provider || !entry) {
    return handlers.POST(req);
  }
  const { config, byEmail } = entry;

  // Read the raw body ONCE up front, then hand Auth.js a FRESH Request built
  // from it. (Cloning a Request and reading the clone's body is unreliable in
  // this runtime — it can leave the original stream locked, throwing "Response
  // body object should not be disturbed or locked" — so we reconstruct instead.)
  // `authReq` is what we ALWAYS delegate with, including on the fail-open path,
  // because the original `req` body may already be consumed by this point.
  let bodyText: string | null = null;
  try {
    bodyText = await req.text();
  } catch {
    // Couldn't read the body — fall through with the untouched original.
  }
  const authReq =
    bodyText !== null
      ? new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: bodyText,
        })
      : req;

  try {
    const ipKey = `${provider}:ip:${getClientIp(req)}`;

    let email = "";
    if (byEmail && bodyText) {
      try {
        email = (new URLSearchParams(bodyText).get("email") ?? "")
          .trim()
          .toLowerCase();
      } catch {
        // Not urlencoded — skip the email key, keep the ip key.
      }
    }
    const emailKey = email ? `${provider}:email:${email}` : null;

    // PEEK (no increment): block an already-over-limit source before we let it
    // reach Auth.js at all.
    const peeks = await Promise.all([
      peekRateLimit({ key: ipKey, ...config }),
      emailKey
        ? peekRateLimit({ key: emailKey, ...config })
        : Promise.resolve({ ok: true, remaining: config.limit, retryAfterSeconds: 0 }),
    ]);
    const blocked = peeks.find((p) => !p.ok);
    if (blocked) {
      return tooManyRequests(blocked.retryAfterSeconds);
    }

    // Delegate to Auth.js, then record a FAILED attempt against both keys.
    const res = await handlers.POST(authReq);
    if (!loginSucceeded(res)) {
      await Promise.all([
        checkRateLimit({ key: ipKey, ...config }),
        emailKey
          ? checkRateLimit({ key: emailKey, ...config })
          : Promise.resolve(null),
      ]);
    }
    return res;
  } catch (error) {
    // FAIL OPEN — a wrapper failure must never break login. Delegate with the
    // reconstructed request (the original body may already be consumed).
    console.error("[auth] login rate-limit wrapper error — passing through:", error);
    return handlers.POST(authReq);
  }
}
