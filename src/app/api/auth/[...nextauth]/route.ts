// Auth.js catch-all route handler.
//
// Auth.js needs HTTP endpoints for its internal flows (sign-in, sign-out,
// callbacks, CSRF token, session lookup). In the App Router we expose them by
// re-exporting the GET/POST handlers produced by the single instance in
// `src/auth.ts`. This lives at /api/auth/* (separate from our own /api/v1/*).

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
