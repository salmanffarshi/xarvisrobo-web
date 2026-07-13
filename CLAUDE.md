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
- Methods: `BKASH`, `NAGAD` (customer submits txn ID + sender number + optional screenshot), and `COD`. (Bank Transfer removed in the D.2 amendment — see ADR-016.)
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

**Customer-facing labels (Phase D.2):** two `OrderStatus` values read differently to customers than their enum name — the ENUM VALUES are unchanged, only the display label (in `src/lib/order-status.ts` + the stepper):
- `IN_PRODUCTION` → shown as **"Preparing"** (never reveal build-to-order).
- `WAITING_FOR_PAYMENT_VERIFICATION` → shown as **"Payment Submitted"**.
Always use the enum value in code/DB/logs; only the label differs.

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
- [x] Phase C.1 — 2026-07-06 — cart: guest cart + merge on login, cart service/API, drawer, cart page, add-to-cart wired
- [x] Phase C.2 — 2026-07-06 — checkout + transactional order placement + confirmation; Phase C complete
- [x] Phase C — cart + checkout — complete (C.1 cart, C.2 checkout + order placement)
- [x] Phase C.3 (revision) — 2026-07-08 — revised order lifecycle (ADR-016): zone-based delivery (explicit Inside/Outside Dhaka radio), method-specific initial status (prepaid → WAITING_FOR_PAYMENT, COD → WAITING_FOR_ORDER_CONFIRMATION), gated manufacturing (no Manufacturing row at placement)
- [x] Phase D.1 — 2026-07-08 — order history list (/account/orders), Orders nav item + Overview count, method-aware status tracker stepper
- [x] Phase D.2 — 2026-07-09 — payment proof form (Cloudinary signed upload) + WhatsApp handoff, COD WhatsApp, label changes, gated action block; Phase D complete
- [x] Phase D — payments + customer dashboard (D.1 order history + tracker, D.2 payment proof + WhatsApp + gated action block)
- [x] Phase E.1 — 2026-07-10 — admin shell + sidebar nav (Dashboard only) + read-only dashboard stats home (requireStaff guard, admin-service, /api/v1/admin/dashboard/stats). ADMIN-only for v1. Next: E.2 order operations (verify payment, confirm COD, advance status) + admin order/payment pages.
- [x] Phase E.2.1 — 2026-07-10 — admin order list (filterable) + read-only order detail (payment proof, history), admin labels, wired dashboard cards. Next: E.2.2 order actions (verify/reject payment, confirm COD, advance status, cancel).
- [x] Phase E.2.2 — 2026-07-10 — order action layer: verify/reject payment, COD confirm, guided status advance, cancel; Manufacturing created at gates; Phase E.2 complete
- [x] Phase E.3 — 2026-07-11 — manufacturing kanban board (stage moves fwd/back, notes), independent of order status
- [x] Phase E.4 — 2026-07-11 — editable settings (payment/WhatsApp/COD, DB-backed Settings singleton), product+category management (CRUD, Cloudinary image uploads, specs-order fix → ordered array), customer management (list/search, notes, deactivate). Three parts A/B/C.
- [x] Phase E.5 — 2026-07-11 — coupon system (%/fixed, min order, total + per-customer caps, expiry); server-side discount; atomic snapshot-on-order redemption; Phase E complete
- [x] Phase E — admin dashboard (products, payments, orders, customers, manufacturing, coupons) — complete
- [x] Phase F — 2026-07-13 — revenue & returns: derived revenue predicate, COD-delivered-marks-paid, RETURNED status + reversal, dashboard return metrics
- [x] Phase G — 2026-07-13 — login lands on Home (callbackUrl preserved); forgot-password (Resend email, hashed single-use 24h tokens)

## Reference documents

Loaded on demand. Do not rewrite these; ask Salman before restructuring.

@./docs/api-endpoints.md
@./docs/architecture-decisions.md
@./docs/progress.md
