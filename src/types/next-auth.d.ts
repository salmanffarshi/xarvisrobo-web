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
   * The shape of the user object returned by the Prisma adapter and passed to
   * the `session` callback. Augmenting it lets the callback read `user.role`
   * without a cast.
   */
  interface User {
    role: UserRole;
  }
}
