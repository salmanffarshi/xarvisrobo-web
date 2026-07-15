// Auth.js (NextAuth v5) — EDGE-SAFE config half of the split.
//
// This file is the ONLY auth config the Edge middleware imports. It must never
// pull in Node-only modules — no Prisma (`@/lib/db`), no bcrypt, no
// `@auth/prisma-adapter`, no provider `authorize` (those all live in the Node
// half, `src/auth.ts`). Keeping this file free of that static import graph is
// what keeps the Edge middleware bundle under Vercel's 1 MB limit.
//
// Session strategy is "jwt" (ADR-014): `id` and `role` ride inside the signed
// cookie, so the edge can authorize purely from the token's `role` claim with
// NO database access. Deactivation (`isActive`) and the DB-backed jwt re-check
// stay on the Node side — see the jwt callback in `src/auth.ts`.

import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

export const authConfig = {
  session: {
    // 30 days is the hard cap for the signed JWT cookie. Staff sessions are
    // expired earlier (8h) via the role-based `expiresAt` in the jwt callback,
    // which lives in the Node half (src/auth.ts) alongside the DB re-check.
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  pages: {
    // Customer-facing sign-in page. Admin login uses its own page and a
    // hard-coded redirect flow, so it does not rely on this setting.
    signIn: "/login",
  },
  // Providers (the Credentials authorize functions that need Prisma + bcrypt)
  // are supplied only in the Node instance (src/auth.ts). Empty here so this
  // config stays edge-safe.
  providers: [],
  callbacks: {
    // Copy id + role from the token onto `session.user`. This runs at the EDGE
    // too, so it is required here: without it, `req.auth.user.role` would be
    // undefined and the middleware could not read the role claim. Pure — no DB.
    // The custom token fields read back as `unknown` (see src/types/next-auth.d.ts),
    // so we guard them.
    session: ({ session, token }) => {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (typeof token.role === "string") {
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
