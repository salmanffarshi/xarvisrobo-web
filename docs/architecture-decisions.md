# Architecture Decisions

A running log of the "why" behind non-obvious choices. New decisions get appended
here. Never delete old ones — mark them superseded instead.

---

## ADR-001: Next.js 15 App Router as full-stack framework

**Decision:** Single Next.js app serves the customer site, admin dashboard, and API. Not a split frontend/backend.

**Why:**
- One codebase, one deploy target — easier for a beginner + partner team.
- App Router's server components mean most pages render on the server without extra API layers.
- Employability: Next.js is the most in-demand React framework for jobs.

**Tradeoff:** Locks us to Node.js runtime. If we later need a separate Go/Python service, we'd add it as a microservice — not a rewrite.

---

## ADR-002: Two isolated auth contexts (customer + admin)

**Decision:** Customer sessions and admin sessions live in separate cookies via separate Auth.js providers. `/admin/login` is a different endpoint than `/login`.

**Why:**
- Security. A leaked customer session cookie cannot access admin endpoints, even if the DB record shows that user has an ADMIN role.
- Clearer audit trail. Every admin action is signed by an admin session.
- Session policy can differ (admin sessions shorter, harder rotation).

**Tradeoff:** Same person needing both roles must log in twice. Fine — this is not a common case.

---

## ADR-003: Business logic in `/src/services/*`, not route handlers

**Decision:** API route files under `src/app/api/v1/**` are thin HTTP glue only. All logic lives in `src/services/*.ts` (`orderService`, `paymentService`, `manufacturingService`, etc.).

**Why:**
- The future mobile app will hit `/api/v1/*` and expect the same behavior. Services encapsulate that behavior once.
- Testable in isolation without spinning up HTTP.
- Route handlers stay short and skimmable.

**Rule:** If a route handler has more than ~20 lines of logic, it belongs in a service.

---

## ADR-004: JSON snapshots on Order and OrderItem

**Decision:** `Order.shippingAddress` and `OrderItem.productSnapshot` store JSON copies of the address and product at order-placement time. They do NOT foreign-key back to the live Address / Product for display.

**Why:**
- Customer edits their saved address → order history must show the address they used at purchase.
- Admin updates a product name or price → historical orders must show the name/price at the time of purchase.
- Legal / invoicing requirement in most jurisdictions.

**Tradeoff:** Slightly more storage. Queries by "orders shipping to Dhaka" require JSON path queries. Acceptable — this is a rare admin query, not a hot path.

---

## ADR-005: Server-side price computation

**Decision:** The client sends `{ productId, quantity }` for cart and orders. The server always looks up the current price from the DB and computes totals. Client-sent totals are ignored.

**Why:**
- Prevents tampering. A browser DevTools user cannot buy a robot for ৳1.
- Single source of truth for pricing rules (COD delivery charge, discounts later).

---

## ADR-006: Order status split (customer-facing vs internal manufacturing)

**Decision:** Two separate enums. `OrderStatus` on `Order` is what the customer sees. `ManufacturingStatus` on the separate `Manufacturing` model is internal.

**Why:**
- Customer does not care about `FIRMWARE_INSTALLED` vs `TESTING`. They care about "In Production" vs "Shipped".
- Internal workflow changes (add a `PACKAGING_QC` stage) do not force customer-facing status changes.
- Different roles read different tables. Support agents don't need manufacturing details unless they open the internal panel.

---

## ADR-007: Order number format `XR-YYYY-NNNN`

**Decision:** Human-readable order number, e.g. `XR-2026-0001`. Used in URLs and customer communications. Internal `cuid()` id is never shown.

**Why:**
- Customer can read it over the phone to support.
- WhatsApp-friendly. Easier than `cln7x9k2a0001qi3d...`.
- Sequential number resets yearly, making order volume trackable at a glance.

---

## ADR-008: Manual payment verification (no gateway in v1)

**Decision:** Customer submits payment info (txn ID, sender number, screenshot). Admin manually verifies before order confirms.

**Why:**
- No merchant account needed to launch.
- bKash / Nagad / Bank transfer are the dominant payment methods in Bangladesh for small e-commerce.
- Xarvisrobo can move to SSLCommerz or aamarPay integration later without customer-facing changes to the checkout flow (payment method selection UI stays).

**When to add a gateway:** once monthly order volume makes manual verification a bottleneck (say, 100+ orders/month).

---

## ADR-009: COD delivery charge ৳130 as an `Order.deliveryCharge` field

**Decision:** COD orders get a `deliveryCharge` of `130` BDT added to the total. Non-COD orders get `0`.

**Why:**
- COD has real cost (courier collection fee).
- Making it a field on Order (not hardcoded in checkout logic) means we can vary it later per courier / per weight without a DB migration.
- Transparent to customer on the order confirmation.

---

## ADR-010: Cloudinary for image storage, not database blobs or local disk

**Decision:** Product images and payment screenshots upload to Cloudinary, DB stores only the URL.

**Why:**
- Vercel serverless functions have small ephemeral disks; local storage doesn't survive deploys.
- Storing blobs in Postgres bloats DB and slows backups.
- Cloudinary handles resizing, format conversion (WebP), CDN.

---

## ADR-011: Neon Postgres in Singapore region

**Decision:** Neon `ap-southeast-1` (Singapore).

**Why:**
- Lowest latency to Bangladesh among Neon's available regions.
- Neon's serverless-first architecture matches Vercel's cold-start model.
- Free tier is enough for early production; scaling is a pricing change, not a migration.
