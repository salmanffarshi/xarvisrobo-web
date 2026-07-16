// Next.js instrumentation (Phase J.3 Part D).
//
// `onRequestError` (Next 15) fires for any unhandled server-side error across
// route handlers, RSC render, and server actions. We forward it to a throttled,
// best-effort Telegram alert (src/lib/error-alert.ts) so outages are noticed
// fast — without a phone that's unusable during an incident (see the throttle).
//
// We only do DB/Telegram work on the Node.js runtime: Prisma and the Telegram
// client cannot run on the Edge runtime, and `src/lib/error-alert.ts` is
// server-only. Edge errors are skipped (they're rare here). The whole hook is
// defensive — a failure to alert must never surface to the user.

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Skip the Edge runtime (no Prisma / Telegram there). Only alert from Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    // Import lazily so the server-only module is never pulled into an Edge
    // bundle by a static import in this (dual-runtime) file.
    const { reportServerError } = await import("@/lib/error-alert");
    await reportServerError(error, {
      routePath: context.routePath,
      path: request.path,
      method: request.method,
      routeType: context.routeType,
    });
  } catch {
    // Never throw from instrumentation.
  }
};
