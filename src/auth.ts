// Auth.js (NextAuth v5) — single instance for the whole app.
//
// Per ADR-013 we run ONE Auth.js instance with TWO Credentials providers,
// not two isolated instances. The security boundary is the per-provider
// `authorize` function plus server-side role checks (middleware + layouts),
// NOT cookie isolation.
//
// Session strategy is "jwt" (ADR-014, superseding the DB-sessions part of
// ADR-013 / Decision 3). Auth.js v5's Credentials provider only supports JWT
// sessions — database strategy throws `UnsupportedStrategy` at runtime. With
// JWT, `id` and `role` ride inside the signed cookie, so edge middleware can
// read them with no DB call. The security intent is preserved by (a) an
// `isActive` re-check in the jwt callback on the Node runtime, and (b) role
// re-validation at the service layer for sensitive actions (ADR-013).

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { customerLoginSchema, adminLoginSchema } from "@/lib/validations/auth";
import { isStaff } from "@/lib/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The Prisma adapter still manages the User and Account tables. Only the
  // Session table goes unused under JWT strategy (kept in the schema for now).
  adapter: PrismaAdapter(db),
  session: {
    // 30 days is the hard cap for the signed JWT cookie. Staff sessions are
    // expired earlier (8h) via the role-based `expiresAt` in the jwt callback.
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  pages: {
    // Customer-facing sign-in page. Admin login uses its own page and a
    // hard-coded redirect flow, so it does not rely on this setting.
    signIn: "/login",
  },
  providers: [
    // ── Provider 1: customers ────────────────────────────────────────────
    // Only authenticates users whose role is exactly CUSTOMER.
    Credentials({
      id: "customer-credentials",
      name: "Customer",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        // 1. Shape-validate the submitted credentials.
        const parsed = customerLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // 2. Look the user up by (normalized, lowercased) email.
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        // 3. Customers only — a staff account cannot log in here.
        if (user.role !== "CUSTOMER") return null;

        // 4. Deactivated accounts cannot log in.
        if (!user.isActive) return null;

        // 5. Account must have a password set (OAuth-only users wouldn't).
        if (!user.passwordHash) return null;

        // 6. Constant-time-ish hash comparison via bcrypt.
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // 7. Success. Return a sanitized user (never the password hash).
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),

    // ── Provider 2: staff/admin ──────────────────────────────────────────
    // Authenticates any staff role (everything except CUSTOMER).
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = adminLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        // Staff only — a CUSTOMER account is rejected here.
        if (!isStaff(user.role)) return null;

        // Deactivated staff cannot log in.
        if (!user.isActive) return null;

        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Runs on sign-in and on every subsequent request that resolves the
    // session (including edge middleware). Under JWT strategy this is where
    // identity + role live and where we enforce expiry / deactivation.
    jwt: async ({ token, user }) => {
      // ── Sign-in: `user` comes from a provider's authorize(). ──
      if (user) {
        token.id = user.id;
        token.role = user.role;
        // Role-based absolute expiry: staff sessions are short-lived (8h),
        // customer sessions long-lived (30d).
        const EIGHT_HOURS_MS = 60 * 60 * 8 * 1000;
        const THIRTY_DAYS_MS = 60 * 60 * 24 * 30 * 1000;
        token.expiresAt =
          Date.now() + (user.role !== "CUSTOMER" ? EIGHT_HOURS_MS : THIRTY_DAYS_MS);
        return token;
      }

      // ── Subsequent requests: `user` is absent. ──
      // 1. Enforce the role-based expiry we stamped above.
      if (typeof token.expiresAt === "number" && Date.now() > token.expiresAt) {
        return null; // expired → Auth.js invalidates the session
      }

      // 2. Re-check the account is still active. This needs a DB read, which
      //    cannot run on the Edge runtime (middleware). We therefore skip it on
      //    edge and let the Node-runtime layouts/services enforce isActive.
      //    `token.id` is `unknown` on the base JWT type — guard it to a string.
      if (process.env.NEXT_RUNTIME !== "edge" && typeof token.id === "string") {
        const dbUser = await db.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, role: true },
        });
        if (!dbUser || !dbUser.isActive) {
          return null; // deactivated or deleted → invalidate
        }
        // Keep role fresh if an admin changed it mid-session.
        token.role = dbUser.role;
      }

      return token;
    },

    // Copy id + role from the token onto `session.user` so `session.user.role`
    // is available everywhere. The custom token fields read back as `unknown`
    // (see the note in src/types/next-auth.d.ts), so we guard them.
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
});
