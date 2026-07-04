# Progress Log

Chronological one-line entries as work completes. Newest at the top.

Format: `YYYY-MM-DD — Phase X.Y — what was done`

---

2026-07-04 — Phase A.2 — installed Prisma 6 + @prisma/client, Auth.js v5 (next-auth@beta), @auth/prisma-adapter, bcryptjs, zod. Added prisma/schema.prisma (generator + datasource only, no models), src/lib/db.ts singleton. Wired DATABASE_URL + AUTH_SECRET + NEXTAUTH_URL in .env. Neon connection verified (SELECT 1). Approved Prisma build scripts in pnpm-workspace.yaml.

2026-07-04 — Phase A.1 — scaffolded Next.js 15 + TS + Tailwind (v4) + shadcn/ui (new-york, slate), strict TS, initialized git + committed, pushed to https://github.com/salmanffarshi/xarvisrobo-web

<!-- Add entries above this line as phases complete. Example:
2026-07-05 — Phase A.1 — scaffolded Next.js 15 + TS + Tailwind + shadcn/ui, initialized git, pushed to github.com/salmanfarshi/xarvisrobo-web
-->

2026-07-04 — Planning — schema, API spec, architecture decisions, and setup checklist locked in web chat. Ready for Phase A.1.
