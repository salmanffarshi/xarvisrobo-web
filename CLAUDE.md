# Xarvisrobo — Project Constitution

> This file is loaded by Claude Code at the start of every session. It defines
> how Claude works on this codebase. Keep it under 200 lines. Reference docs
> are imported at the bottom.

## Project overview

Xarvisrobo is a robotics e-commerce + manufacturing platform for a Bangladesh-based
robotics company selling AI-enabled desk robots. This repository is the customer
website + internal admin/manufacturing dashboard. A future mobile app will be a
separate project; the API here (`/api/v1/*`) is designed for the mobile app to
reuse without rewrite.

- Owner: Salman Farshi (BSc CSE at AIUB, complete web dev beginner)
- Company: Xarvisrobo — pre-launch, first two robot designs in progress
- Market: Bangladesh initially, BDT currency

## Working style

Act as a senior software architect and lead full-stack engineer.

- **Plan before coding.** For non-trivial changes, explain the plan before editing files.
- **Recommend better approaches with reasoning** if you see one — but explain why before implementing.
- **Prioritize maintainability, scalability, and production-quality design** over quick fixes.
- **Salman is a complete beginner.** Explain concepts inline. Do not assume familiarity with Next.js, Prisma, or Auth.js patterns.
- **Ask before any irreversible action:** `git push --force`, `git reset --hard`, dropping DB tables, deleting files, force-migrations.
- **When you hit an error**, explain what it means before proposing a fix.
- **Never commit secrets.** Refuse if asked. Anything in `.env` stays local.

## Tech stack (locked — do not substitute without asking)

- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS + shadcn/ui (`new-york` style, `slate` base color)
- pnpm (never npm or yarn)
- PostgreSQL on Neon (region `ap-southeast-1` Singapore)
- Prisma ORM
- Auth.js (NextAuth v5)
- Cloudinary for image storage
- Resend for transactional email
- SMS provider TBD (BulkSMSBD / SSL Wireless later — stub the interface for now)
- Hosting: Vercel (added in Phase G)

## Architecture principles

1. **Versioned API.** All client-consumed endpoints live under `/api/v1/*`. Never call server functions directly from client components for anything the future mobile app will also need.
2. **Two isolated auth contexts.** Customer session and admin session are separate cookies via separate Auth.js providers. Admin login is `/admin/login`. A customer session must never grant access to `/api/v1/admin/*`.
3. **Role-based access from day one.** Roles: `CUSTOMER, ADMIN, MANAGER, ENGINEER, QC, SUPPORT`. Never hardcode `isAdmin` — check role via a `permissions.ts` helper.
4. **Business logic lives in `/src/services/*`.** Route handlers are HTTP glue only (parse request, check auth, call service, return response). All rules, DB writes, validation, and notifications live in service functions the mobile app will later reuse.
5. **JSON snapshots on Order.** `Order.shippingAddress` and `OrderItem.productSnapshot` are JSON. Historical orders must not mutate when a user later edits their address or a product name changes.
6. **Server-side price computation.** Never trust client-sent prices or totals. Always recompute from DB on order/cart actions.
7. **Order status is split.** Customer-facing (`OrderStatus`) is simplified. Internal manufacturing (`ManufacturingStatus`) lives on the separate `Manufacturing` model and is never exposed to customers.
8. **Every mutation is auditable.** Order status changes append to `OrderStatusHistory`. Payment verification writes `verifiedById` and `verifiedAt`.

## Payment logic

- No payment gateway. Manual verification only.
- Methods: `BKASH`, `NAGAD`, `BANK` (customer submits screenshot + txn ID + sender number + paid amount), and `COD`.
- **COD adds a flat ৳130 delivery charge** as `Order.deliveryCharge`. Non-COD methods have 0 delivery charge unless explicitly configured.
- Currency is always BDT. Stored as `String @default("BDT")` for future-proofing.
- Bangladesh-only shipping in v1.

## Order status flows

**Non-COD:**
`AWAITING_PAYMENT_VERIFICATION → PAYMENT_VERIFIED → CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED`

**COD:** skip payment verification, start at `CONFIRMED` after admin review.

**Cancellation:** allowed only before status = `IN_PRODUCTION`. Terminal state.

**Manufacturing (internal, admin-only):**
`WAITING_FOR_PRODUCTION → COMPONENTS_COLLECTED → ASSEMBLY → FIRMWARE_INSTALLED → TESTING → QC → PACKAGING → READY_TO_SHIP`

**Manufacturing stage advancement does NOT auto-transition customer-facing status.** Admin explicitly clicks "Mark as Shipped" when the courier is actually notified.

## Out of scope for v1 (do not build unless explicitly asked)

Architecture must accommodate these later without redesign, but do not build them now:

- Mobile app
- Robot control, pairing, registration
- AI assistant configuration
- OTA firmware updates
- Robot diagnostics
- Warranty portal, repair requests, spare parts store
- Dealer / distributor portals

If Salman asks for one of these, remind him it was scoped out of v1 and confirm before building.

## Code conventions

- TypeScript strict. No `any`. Prefer `unknown` + type guards.
- Async functions must handle errors explicitly. Never swallow exceptions.
- Money values: `Decimal` in Prisma, strings on the wire (`"1250.00"`).
- Route handlers under `src/app/api/v1/**`. Business logic under `src/services/**`.
- Path alias `@/` maps to `src/`.
- Prefer shadcn/ui primitives over custom components.
- Error responses: `{ error: { code, message, details? } }` with correct HTTP status.
- IDs: `cuid()` (Prisma default).
- Order lookups by `orderNumber` (e.g. `XR-2026-0001`) in URLs, never by internal `id`.
- Never place secrets, keys, or personal data in URLs, query strings, or logs.
- File names: `kebab-case.ts` for utils, `PascalCase.tsx` for React components.
- Server components by default. Only mark `"use client"` when the component needs interactivity.

## Commands

- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Type check: `pnpm typecheck`
- Prisma migrate (dev): `pnpm prisma migrate dev`
- Prisma studio (DB GUI): `pnpm prisma studio`
- Prisma client regen: `pnpm prisma generate`
- Seed DB: `pnpm db:seed`
- Create staff/admin account (interactive): `pnpm create-admin`

## Build phase status

Update this list as each phase completes. Also append a one-line note to `docs/progress.md`.

- [x] Phase A.1 — scaffold Next.js + TS + Tailwind + shadcn/ui + git + GitHub — 2026-07-04 — scaffolded
- [x] Phase A.2 — install Prisma + Auth.js + supporting packages, wire up Neon — 2026-07-04 — Prisma + Auth.js installed, Neon connected
- [x] Phase A.3 — drop in schema, run first migration — 2026-07-04 — full schema in place, first migration run, Prisma client generated
- [x] Phase A.4 — 2026-07-04 — Auth.js configured (JWT strategy per ADR-014), middleware live, register + login + admin-login pages, create-admin CLI, all flows verified
- [x] Phase B.1 — 2026-07-04 — public pages, contact form working, SEO basics, auth-aware nav
- [x] Phase B.2 — 2026-07-05 — catalog live: 2 products seeded, list + detail pages, service + API layer, featured products on home, SVG placeholders
- [x] Phase B.3 — 2026-07-05 — customer account: profile, password change, addresses CRUD
- [x] Phase B — complete (B.1 public pages, B.2 catalog, B.3 customer accounts)
- [ ] Phase C — cart + checkout
- [ ] Phase D — payments + customer dashboard
- [ ] Phase E — admin dashboard (products, payments, orders, customers, manufacturing)
- [ ] Phase F — notifications (email + SMS) + invoices
- [ ] Phase G — pre-launch (security review, deploy)

## Reference documents

Loaded on demand. Do not rewrite these; ask Salman before restructuring.

@./docs/api-endpoints.md
@./docs/architecture-decisions.md
@./docs/progress.md
