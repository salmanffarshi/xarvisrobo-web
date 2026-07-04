// Type augmentation for Auth.js (NextAuth v5).
//
// Auth.js ships a default `Session.user` shape of { name, email, image }.
// Our app needs `id` and `role` on the session user so that server components,
// middleware, and services can do `session.user.role` with full type safety.
//
// This file uses TypeScript "declaration merging": by re-declaring the
// `next-auth` module here, our fields are ADDED to Auth.js's built-in types
// rather than replacing them. The `import` statements make this file a module,
// which is required for module augmentation to work.

import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  /**
   * Returned by `auth()`, `useSession`, etc. We extend the default user with
   * our own `id` and `role`, keeping the built-in fields (name/email/image).
   */
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  /**
   * The shape of the user object returned by a provider's `authorize()` and
   * passed to the `jwt` callback on sign-in. Augmenting it lets the callback
   * read `user.role` without a cast.
   */
  interface User {
    role: UserRole;
  }
}

// NOTE ON THE JWT TOKEN: Under JWT strategy we also store `id`, `role`, and
// `expiresAt` on the token. We deliberately do NOT augment the `JWT` interface
// here: it is declared in `@auth/core/jwt` (a transitive dep that pnpm does not
// expose at the project root), so a `declare module` for it does not merge —
// it would create a separate ambient module instead. The `JWT` interface
// already has a `Record<string, unknown>` index signature, so the callbacks in
// src/auth.ts read those custom fields back with `typeof` type guards.
