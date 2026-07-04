// Auth.js (NextAuth v5) — single instance for the whole app.
//
// Per ADR-013 we run ONE Auth.js instance with TWO Credentials providers,
// not two isolated instances. The security boundary is the per-provider
// `authorize` function plus server-side role checks (middleware + layouts),
// NOT cookie isolation.
//
// Session strategy is "database" (Decision 3): the session token in the cookie
// is only a lookup key; the authoritative `role`/`id` live in the DB. If a role
// changes in the DB, the next request reflects it.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { customerLoginSchema, adminLoginSchema } from "@/lib/validations/auth";
import { isStaff } from "@/lib/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
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
    // With database sessions the callback receives the DB-backed `user`.
    // We copy id + role onto `session.user` so `session.user.role` is available
    // everywhere (typed via src/types/next-auth.d.ts).
    session: ({ session, user }) => {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
});
