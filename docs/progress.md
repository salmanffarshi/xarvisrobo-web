# Progress Log

Chronological one-line entries as work completes. Newest at the top.

Format: `YYYY-MM-DD — Phase X.Y — what was done`

---

2026-07-06 — Phase C.1 — cart complete: guest localStorage cart + merge-on-login, cart-service with ownership checks, /api/v1/cart/* + products/by-ids, unified cart provider, header badge + drawer, /cart page, add-to-cart wired on detail + cards, 5-per-item cap, live-price cart math (ADR-015). 17/17 E2E checks green (11 curl API checks + 16 browser-driven + curl ownership attack: customer B PATCH/DELETE on customer A's cart item id → 404, cart untouched). Test users cleaned up.

2026-07-05 — Phase B.3 — customer account area: sidebar/tabs layout, overview, profile edit, change-password, full address CRUD with default handling and ownership checks, /api/v1/me/* endpoints, account-service + address-service. Phase B complete. 22/22 E2E checks green (browser-driven via headless Chrome + curl ownership probe: customer B fetching customer A's address id → 404, no data leak). Test users cleaned up.

2026-07-05 — Phase B.2 — product catalog: seeded 2 desk robots + 2 categories, product-service + category-service, /api/v1/products + /api/v1/categories + /api/v1/products/[slug], /products list page with URL-based search/filter/sort/pagination, /products/[slug] detail with SVG placeholder hero, featured products section on home, sitemap includes products. 25/25 end-to-end checks green (20 browser-driven via headless Chrome + API/SEO curl checks).

2026-07-04 — Phase B.1 — public marketing pages (home, about, FAQ, warranty, privacy, T&C), contact form + API + service, design system foundation (Geist + brand blue + premium minimalist tokens), SEO basics (metadata, robots, sitemap), auth-aware nav. 25/25 automated checks green; all test rows cleaned up (DB has 0 users).

2026-07-04 — Phase A.4 — Auth.js v5 with two Credentials providers (customer + admin). Hit the documented `UnsupportedStrategy` blocker (Credentials require JWT, not DB sessions) — escalated, landed ADR-014 (JWT strategy supersedes DB-sessions decision in ADR-013), preserving revocation intent via role-based token maxAge (8h staff / 30d customer) + Node-runtime isActive re-check in the jwt callback + service-layer re-validation. Edge middleware + Node layout guards enforce role-based routing; introduced `admin/(dashboard)` route group so the guard never wraps `/admin/login` (avoids redirect loop). Built auth foundation (next-auth.d.ts, zod schemas + top-100 common-password blocklist, permissions helpers), route groups + layouts, hand-added shadcn `input/label/card/form/alert` (ADR-012), register/login/admin-login pages, register API over `auth-service`, and the `pnpm create-admin` CLI (line-queue stdin for reliable piped+interactive input). End-to-end verified: 20/20 auth checks green (register, login, signout, wrong-password no-leak, cross-provider role rejection, admin CLI + idempotency, common-password + duplicate-email blocks). All test rows cleaned up; DB has 0 users.

2026-07-04 — Phase A.3 — dropped full production schema (19 models, 6 enums) into prisma/schema.prisma, ran init migration (20260704080010_init) on Neon dev DB — 19 tables + 6 enum types created, generated Prisma client, verified via type-safe smoke test (user.count = 0). Added tsx dev dep (approved esbuild build in pnpm-workspace.yaml), wired up placeholder db:seed (prisma/seed.ts + package.json prisma.seed block).

2026-07-04 — Phase A.2 — installed Prisma 6 + @prisma/client, Auth.js v5 (next-auth@beta), @auth/prisma-adapter, bcryptjs, zod. Added prisma/schema.prisma (generator + datasource only, no models), src/lib/db.ts singleton. Wired DATABASE_URL + AUTH_SECRET + NEXTAUTH_URL in .env. Neon connection verified (SELECT 1). Approved Prisma build scripts in pnpm-workspace.yaml.

2026-07-04 — Phase A.1 — scaffolded Next.js 15 + TS + Tailwind (v4) + shadcn/ui (new-york, slate), strict TS, initialized git + committed, pushed to https://github.com/salmanffarshi/xarvisrobo-web

<!-- Add entries above this line as phases complete. Example:
2026-07-05 — Phase A.1 — scaffolded Next.js 15 + TS + Tailwind + shadcn/ui, initialized git, pushed to github.com/salmanfarshi/xarvisrobo-web
-->

2026-07-04 — Planning — schema, API spec, architecture decisions, and setup checklist locked in web chat. Ready for Phase A.1.
