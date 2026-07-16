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

---

## ADR-012: shadcn/ui set up manually (CLI incompatible with current registry)

**Decision:** The shadcn/ui pieces in this project — `components.json`, `src/lib/utils.ts`, the theme in `src/app/globals.css`, and every `src/components/ui/*` component — are added and maintained **by hand**, not via the `shadcn` CLI. New components are added by copying their source into `src/components/ui/` and installing any missing dependencies with `pnpm add`.

**Why (discovered during Phase A.1, 2026-07-04):**
- CLAUDE.md locks shadcn/ui to the **new-york** style + **slate** base color.
- The current shadcn CLI is **v4.x**, which replaced the classic init with a new "templates + presets" model (default preset `base-nova`, Radix vs Base UI primitives). It no longer exposes `new-york` / `slate` — using it would silently substitute a different design system.
- Pinning to the classic **`shadcn@2`** CLI *does* accept `--base-color slate` (new-york is its default) and correctly wrote `components.json`, but its `init` / `add` then fail against shadcn's **live registry** with `Validation failed: - css: Invalid input` — the registry's response schema has moved past what the v2 CLI can parse. Pinning the CLI version doesn't help when the registry it depends on has moved on.
- Neither the latest nor the pinned-classic CLI can complete the setup. Writing the files by hand produces the *identical* new-york/slate result and is fully deterministic.

**How to add a component later:** copy the component's source file(s) into `src/components/ui/`, then `pnpm add` any new dependencies it imports. `components.json` stays the source of truth for style/alias config. Dependencies already installed in A.1: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `tw-animate-css`.

**Tradeoff:** No one-command `shadcn add`. Slightly more manual work per component, and we must keep an eye on component source staying compatible with our pinned versions. Acceptable — it's the only path that honors the locked new-york/slate choice, and the components are stable, well-known source files.

**Revisit if:** shadcn ships a CLI path that can target new-york/slate against a working registry again, or the team decides to adopt the v4 preset model (which would supersede this ADR and require updating CLAUDE.md's locked style/base-color).

---

## ADR-013: Single Auth.js instance with role-based routing (not two isolated instances)

**Date:** 2026-07 (Phase A.4)

**Decision:** One Auth.js v5 instance handles both customer and admin authentication.
Two `Credentials` providers within the same instance:

- `customer-credentials` — authorize only if user's role is `CUSTOMER`
- `admin-credentials` — authorize only if user's role is any staff role
  (`ADMIN`, `MANAGER`, `ENGINEER`, `QC`, `SUPPORT`) AND `isActive` is true

One session cookie, one session store (database strategy via Prisma adapter).
The session record carries `role` and `id`. Access control enforced by middleware
+ layout guards that read `session.user.role`.

This **partially supersedes ADR-002**'s wording about "two isolated Auth.js
providers." ADR-002's security intent (a customer session can never perform
an admin action) is fully preserved. What changes is the implementation:
one instance, two providers within it, strict role-based routing.

**Why not two truly-isolated Auth.js instances:**
- Auth.js v5 has no first-class support for running two instances in one app.
  Getting two configs to coexist requires custom cookie handling, custom
  adapter wiring, and hand-written session callbacks. That is exactly the
  kind of custom auth code where security bugs live.
- The isolation benefit (customer cookie *cannot reach* admin routes because
  the cookie name differs) is defense-in-depth on top of the actual security
  boundary (server-side role check). Adding the defense-in-depth layer here
  costs us significant custom-code surface for marginal gain.
- Well-trodden path > clever path for beginners on a real project.

**Why role-based routing works:**
- Every `/admin/*` request runs through middleware verifying the session
  role is NOT `CUSTOMER`. Missing/wrong role → redirect to `/admin/login`.
- Every `/account/*` request verifies the role IS `CUSTOMER`. Wrong role
  → redirect to `/admin` (or `/admin/login` if unauthenticated).
- Customer login form calls `signIn("customer-credentials", …)` — the
  provider's `authorize` refuses non-customer users.
- Admin login form calls `signIn("admin-credentials", …)` — the provider's
  `authorize` refuses customers and refuses inactive staff.
- Layout components ALSO check role as a second gate. Middleware is coarse
  (edge runtime, limited APIs); layouts are precise (full Node runtime).

**How the isolation is maintained in practice:**
- Session cookie is signed with `AUTH_SECRET`; role can't be tampered with client-side.
- With database sessions, the source of truth for role is the DB row, not the
  cookie payload. Change the role in DB → next request reflects it.
- Any admin action re-fetches the current session and re-validates role at the
  service-function level, not just at the route boundary.

**Tradeoff accepted:** Slightly weaker "belt" (one cookie for both contexts)
in exchange for far simpler implementation and standard patterns. The
"suspenders" (server-side role enforcement) do the real security work.

**Revisit if:**
- We ever need a customer and a staff member to hold overlapping simultaneous
  sessions in the same browser (currently impossible — one cookie).
- Auth.js releases first-class multi-instance support.
- A concrete threat model emerges that role-based routing does not defend
  against but cookie isolation would.

---

## ADR-014: JWT session strategy for Auth.js Credentials (supersedes DB-sessions decision in ADR-013)

**Date:** 2026-07 (mid-Phase A.4)

**Decision:** Auth.js v5 is configured with `session: { strategy: "jwt" }`.
This **reverses** the "database sessions" portion of ADR-013 / Phase A.4
Decision 3. All other A.4 decisions (single Auth.js instance, two Credentials
providers, role-based routing, NIST-modern passwords, CLI admin creation)
remain in force unchanged.

**Why the reversal was necessary (not preference — technical constraint):**

Auth.js v5's `@auth/core` throws a hard `UnsupportedStrategy` error at runtime
whenever the `Credentials` provider is combined with `strategy: "database"`.
The message is unambiguous: "Signing in with credentials only supported if
JWT strategy is enabled." This is an architectural assertion in the library,
not a warning or a soft failure — the app is non-functional under our
originally-intended configuration.

We proved this empirically during Phase A.4 Step 4 by shipping the config
exactly as ADR-013 specified. Build passed. Runtime failed on every
`auth()` call. Unauthenticated `GET /admin` slipped through the middleware
gate (returning 404 instead of the expected redirect) because `req.auth`
came back as a truthy-but-empty object under the failed assertion, silently
bypassing the role check.

Workarounds considered:

1. **Custom encode/decode for Credentials with DB sessions.** Requires
   hand-written cryptographic session code — exactly the "custom auth code
   where security bugs live" that ADR-013 explicitly warns against. Also
   does not solve the edge-middleware problem below.
2. **Node-runtime middleware.** Would allow Prisma calls from middleware,
   but is still experimental in Next.js 15 and would require the split
   `auth.config.ts` pattern that our A.4 prompt forbids.
3. **Rip out Auth.js, roll our own with iron-session or lucia-auth.**
   Massive scope creep mid-phase. `lucia-auth` is being deprecated by
   its own maintainer. Not a viable path.

None of the workarounds beats the mainstream JWT path on either security
or maintainability.

**What we lose vs. DB sessions:**

- Instant server-side revocation by deleting a row. Under JWT, a compromised
  session remains valid until the token expires or a token-invalidation
  mechanism kicks in.

**What we preserve (the security intent of Decision 3):**

The original reason for choosing DB sessions was the ability to instantly
kick out a compromised admin. Under JWT, we achieve substantially the same
guarantee through three mechanisms enforced together:

1. **Role-differentiated JWT `maxAge`.** Customer tokens live 30 days
   (Auth.js default). Admin tokens live **8 hours**. Enforced in the
   `jwt` callback: if `token.role !== "CUSTOMER"`, set a shorter
   expiration. Worst-case exposure of a stolen admin token is 8 hours.

2. **Service-layer re-validation of `isActive`.** Every sensitive admin
   action re-fetches the user from the DB inside the service function
   (per architecture principle 4) and checks `user.isActive`. Setting
   `isActive = false` on a compromised admin causes their very next
   action to fail. This was already an ADR-013 requirement; ADR-014
   makes it load-bearing.

3. **`isActive` check on JWT refresh.** Inside the `jwt` callback, on
   every token refresh (`trigger === "update"` or expiration-triggered
   refresh), look up the user's current `isActive`. If false, invalidate
   the token. Belt on top of the service-layer suspenders.

The net result: an admin whose account is disabled cannot perform any
admin action after that disable is committed to the DB, even if their
token has time left on it. The window between "we notice compromise" and
"attacker is locked out" is one request, not "until token natural expiry."

**What we lose vs. JWT-default (accepting we're on JWT):**

- We do not get the "audit trail of active sessions" that a `Session`
  table would give us. This is a Phase F+ concern (session listing UI),
  and if we need it later we can add a separate `ActiveSession` model
  tracked by the JWT `jti`.

**Session content (JWT payload):**

- `id` (string) — user id
- `role` (UserRole enum) — for edge middleware routing
- `name`, `email` — for UI

Everything else stays in the DB and is fetched by services when needed.

**Middleware implication:**

Edge middleware reads `req.auth` (Auth.js-decoded JWT), which now contains
role directly. No DB call needed at the edge. This resolves the second
wall Claude Code identified during A.4 Step 5 — role-based routing works
on the edge without Node runtime or split configs.

**Revisit if:**

- Auth.js v5 (or v6) ships first-class Credentials + DB sessions support.
- We hit a real incident where the 8-hour admin token window costs us
  materially more than what the service-layer + `isActive` guards
  prevent — in which case we'd add a `tokenVersion` field on User and
  bump-to-invalidate all outstanding tokens for that user.
- We adopt a passwordless / OAuth flow that plays better with DB sessions.

---

## ADR-015: Cart uses live product prices; priceSnapshot is informational

**Date:** 2026-07 (Phase C.1)

Cart line totals and subtotal are always computed from the current
`Product.basePrice` at read time, not from `CartItem.priceSnapshot`. The
snapshot records the price when the item was added (useful later for "price
changed since you added this" UX), but is not authoritative for cart math.
Authoritative pricing for an actual order is computed at order-placement time
in Phase C.2 (per ADR-005), snapshotting into OrderItem at that moment. This
keeps the cart honest about current prices while preserving a record of
add-time price. Tradeoff: a price change is reflected immediately in an
existing cart, which is the expected e-commerce behavior.

---

## Known Issue — Product.specifications key order

Postgres jsonb does not preserve object key order. During B.2 we noticed
the specs table renders keys in whatever order Postgres returns them,
not the order they were seeded. Fix (deferred to Phase E when admin
product UI is built): migrate Product.specifications from Json to a
structured array of { label: string; value: string }[]. This lets admins
reorder specs, and the render order is deterministic. Not urgent — the
current display is functional, just not sequenced.

---

## ADR-016: Revised order lifecycle — delivery matrix, COD confirmation gate, method-specific statuses, gated manufacturing

**Date:** 2026-07 (Phase C.3 revision, after C.2 shipped)

**Supersedes:** ADR-009's flat ৳130 COD charge, and the earlier rule that COD
orders jump straight to CONFIRMED and into production at placement.

This ADR redefines the canonical order flow based on real business rules for
custom-built (build-to-order) products in Bangladesh.

---

### 1. Delivery charge (method + zone)

Delivery zone is an EXPLICIT customer choice at checkout — a radio
(Inside Dhaka / Outside Dhaka) shown for every order — NOT derived from the
address district. Rationale: "Dhaka" is ambiguous (district vs city vs
division; Savar/Keraniganj are Dhaka district but out-of-city for couriers),
so an inferred rule is unreliable and high-maintenance. The customer knows
their own delivery zone; a two-option radio is zero-maintenance and honest.

The chosen zone is stored on every order (both prepaid and COD) as
`Order.deliveryZone` (enum `INSIDE_DHAKA | OUTSIDE_DHAKA`), for records and
future courier planning.

Charge, computed server-side at placement from method + stored zone:
- **Prepaid** (BKASH / NAGAD / BANK): FREE everywhere, regardless of zone.
  Deliberate incentive to prefer prepaid.
- **COD, Inside Dhaka**: ৳60.
- **COD, Outside Dhaka**: ৳130.

Charges live in `src/config/payment.ts`:
`COD_DELIVERY_INSIDE_DHAKA = 60`, `COD_DELIVERY_OUTSIDE_DHAKA = 130`.
Prepaid is implicitly 0. Admin-editable in Phase E.

---

### 2. COD confirmation gate

Custom-built products are especially exposed to fake or refused COD orders, so
a COD order does NOT enter production on placement. Flow:

Customer places COD order → status **WAITING_FOR_ORDER_CONFIRMATION** → a
representative phones the customer → customer confirms → admin marks status
**ORDER_CONFIRMED** → manufacturing begins.

No production work (no Manufacturing record) exists before ORDER_CONFIRMED.

---

### 3. Prepaid payment-verification gate

A prepaid order does NOT enter production until payment is verified. Flow:

Customer places order → status **WAITING_FOR_PAYMENT** → payment instructions
shown (send to bKash/Nagad/bank, use order number as reference) → customer
submits proof (txn id, method, sender number, optional screenshot) → status
**WAITING_FOR_PAYMENT_VERIFICATION** → admin verifies → status
**PAYMENT_VERIFIED** → manufacturing begins.

No production work exists before PAYMENT_VERIFIED.

---

### 4. Customer-facing OrderStatus enum (new)

```
enum OrderStatus {
  // Prepaid path
  WAITING_FOR_PAYMENT
  WAITING_FOR_PAYMENT_VERIFICATION
  PAYMENT_VERIFIED
  // COD path
  WAITING_FOR_ORDER_CONFIRMATION
  ORDER_CONFIRMED
  // Shared tail
  IN_PRODUCTION
  SHIPPED
  DELIVERED
  // Terminal
  CANCELLED
}
```

Initial status at placement:
- Prepaid → `WAITING_FOR_PAYMENT`
- COD → `WAITING_FOR_ORDER_CONFIRMATION`

Display labels (customer-facing):
- WAITING_FOR_PAYMENT → "Waiting for Payment"
- WAITING_FOR_PAYMENT_VERIFICATION → "Waiting for Payment Verification"
- PAYMENT_VERIFIED → "Payment Verified"
- WAITING_FOR_ORDER_CONFIRMATION → "Waiting for Order Confirmation"
- ORDER_CONFIRMED → "Order Confirmed"
- IN_PRODUCTION → "In Production"
- SHIPPED → "Shipped"
- DELIVERED → "Delivered"
- CANCELLED → "Cancelled"

Removed from the old enum: `AWAITING_PAYMENT_VERIFICATION`, `CONFIRMED`
(replaced by the method-specific states above).

---

### 5. Manufacturing creation is gated

The `Manufacturing` record is NOT created at order placement. It is created
only when the production gate is passed:
- Prepaid: when admin verifies payment (status → PAYMENT_VERIFIED).
- COD: when the rep-confirmed order is marked ORDER_CONFIRMED.

At creation it starts at `WAITING_FOR_PRODUCTION` (internal stage enum
unchanged). The customer-facing status becomes `IN_PRODUCTION` when the admin
actually starts production (a separate Phase E action) — manufacturing stage
advancement still does not auto-advance customer status (retains the ADR-006
split-status principle).

`Payment` (status PENDING) IS still created at placement for every order
(prepaid and COD alike) — it records the payment intent; only the Manufacturing
row is deferred.

---

### Phase ownership of the transitions

- **C.3 (this revision):** new enum + migration; placement sets the correct
  initial status by method; district-aware delivery charge; placement no
  longer creates a Manufacturing row; checkout + confirmation UI reflect the
  new charges and statuses.
- **Phase D:** customer submits payment proof → transitions WAITING_FOR_PAYMENT
  → WAITING_FOR_PAYMENT_VERIFICATION.
- **Phase E (admin):** verify payment → PAYMENT_VERIFIED (+ create Manufacturing);
  phone-confirm COD → ORDER_CONFIRMED (+ create Manufacturing); start production
  → IN_PRODUCTION; ship; deliver; cancel.

---

### Tradeoffs

- More statuses = a slightly richer state machine, but each maps to a real
  business step the customer and admin both understand.
- Deferring Manufacturing creation means the production queue only ever
  contains real, paid/confirmed work — no speculative rows for orders that
  may be fake or unpaid.
- Prepaid gets free delivery (a margin cost) in exchange for eliminating COD
  risk and improving cash flow — a deliberate incentive.

**Revisit if:** COD fraud drops enough to allow auto-confirmation for trusted
repeat customers; or delivery-cost changes require per-courier / per-weight
charges (would replace the flat inside/outside zone split); or we later want
more than two zones (would extend the DeliveryZone enum + the radio).

---

### D.2 amendment (2026-07-09)

Two simplifications after D.2 shipped, both refining ADR-016's payment surface:

1. **Bank Transfer removed as a payment method.** `PaymentMethod` is now
   `{ BKASH, NAGAD, COD }` (migration `remove_bank_payment_method`). Prepaid
   means bKash or Nagad only. Bank transfer added verification friction (manual
   statement matching) for little demand at this stage; it can return later as
   a new enum value without touching the prepaid flow. Removed across
   schema/config/validation/checkout/confirmation.

2. **Payment proof no longer collects the paid amount.** Each product has a
   fixed, already-communicated price and free prepaid delivery, so the amount is
   known — the customer identifies their payment by transaction ID + sender
   number (+ optional screenshot), which is what the admin verifies against in
   Phase E. The `Payment.paidAmount` column is LEFT in place (nullable,
   unpopulated) — dropping a column is a separate migration and it's harmless;
   only the collection/write and the read-back display were removed.

---

## ADR-017: Coupon rules — subtotal-only discount, server-side compute, atomic row-locked redemption, snapshot on order

**Date:** 2026-07 (Phase E.5)

**Decision:** A coupon system with two discount types (`PERCENTAGE`, `FIXED`),
a minimum-subtotal gate, optional total + per-customer usage caps, and an
optional validity window. The rules below are load-bearing and mirror the
money-path care of the C.2 order transaction.

**1. Subtotal-only discount.** A coupon discounts the order SUBTOTAL only —
never delivery. `total = subtotal − discount + deliveryCharge`. Delivery is
still computed from method + zone (ADR-016) untouched. Rationale: delivery is a
real courier cost; discounting it would erode margin unpredictably, and prepaid
already gets free delivery as its own incentive.

**2. Discount capped at subtotal (never negative).** `computeDiscount` returns
`min(raw, subtotal)`, so a large FIXED coupon can zero the subtotal but never
make the total negative (`total ≥ deliveryCharge ≥ 0`). No max-discount cap for
percentages in v1 (out of scope).

**3. Single source of truth, server-side (ADR-005).** `src/lib/coupon.ts` is a
pure module (`normalizeCode`, `computeDiscount`, `validateCoupon`) used by BOTH
the display-only checkout preview (`POST /api/v1/coupons/validate`) and the
authoritative placement redemption. The client sends only the coupon CODE — the
server computes the subtotal (from the user's own cart) and the discount. A
client-sent discount/subtotal/total is ignored.

**4. Atomic, race-safe redemption.** Redemption happens INSIDE the existing
order-placement transaction. The Coupon row is locked with `SELECT … FOR UPDATE`
before the usage counts are read, so two concurrent placements of the same
coupon serialize: the second blocks until the first commits, then re-counts and
is correctly rejected if a cap is now reached. A cap can never be exceeded under
concurrency. `CouponRedemption.orderId` is `@unique` (one redemption per order);
a rolled-back attempt (orderNumber-collision retry or idempotency race) takes
the redemption row with it, so no coupon is over-used. An idempotent replay
returns the existing order and does NOT redeem again.

**5. Snapshot on the order.** `Order.couponCode`, `Order.couponId`, and
`Order.discountAmount` are frozen at placement. Editing, deactivating, or
deleting the coupon later never mutates a historical order (same principle as
ADR-004's address/product snapshots).

**6. Placement re-validates and rejects (never silently drops).** If the coupon
is invalid at placement — not found, inactive, expired, not-yet-started, below
minimum, or a cap reached since checkout — the WHOLE placement is rejected with
`COUPON_INVALID` (409) and the reason. The order is not silently placed without
the discount the customer expected.

**7. No refund-on-cancel (v1).** Cancelling an order does NOT release its coupon
redemption; the redemption row stays and continues to count toward caps. Simple
and fraud-resistant for launch.

**8. Hard-delete blocked after redemption.** A coupon with any redemption can
only be deactivated (`isActive = false`), never hard-deleted
(`COUPON_HAS_REDEMPTIONS`) — a redemption is an immutable financial record.

**Revisit if:** we need per-percentage max-discount caps, coupon refunds on
cancellation, stacking multiple coupons, or product/category-scoped coupons —
all deferred past v1.

---

## ADR-018: Revenue is derived (predicate), not stored — COD paid at delivery, returns reverse via status

**Date:** 2026-07 (Phase F)

**Decision:** Recognized revenue is DERIVED from current state, never a stored
flag or a separate revenue table. The single rule, expressed once as a Prisma
where-clause in `src/lib/revenue.ts` (`REVENUE_ORDER_WHERE`) and reused by every
revenue query:

  An order contributes to revenue IFF
    Payment.status === VERIFIED  AND  Order.status ∉ { RETURNED, CANCELLED }.

**Consequences (all fall out of the one predicate):**

- **Prepaid** counts from PAYMENT_VERIFIED onward — its Payment goes VERIFIED at
  the E.2.2 verification gate.
- **COD** counts at delivery. Payment is PENDING until then; marking a COD order
  DELIVERED flips its Payment → VERIFIED (verifiedById/verifiedAt = admin/now) in
  the SAME `advanceStatus` transaction (Phase F item #1). This is the whole
  mechanism — there is no separate revenue write; the predicate simply now sees a
  VERIFIED payment on a DELIVERED, non-returned order. Prepaid delivery leaves the
  already-VERIFIED payment untouched.
- **RETURNED** (Phase F item #2) is excluded by status, so revenue reverses
  AUTOMATICALLY and identically for prepaid (counted since verification) and COD
  (counted since delivery). `markReturned` is transactional, guarded to SHIPPED
  (refused on delivery) or DELIVERED (post-delivery) via the shared
  `legalNextActions`, and stores `returnedAt` + `returnReason`.
- **CANCELLED** was already excluded.

**What we deliberately do NOT do (v1):**

- **No refund payment-status.** A returned order keeps its Payment as-is (a
  VERIFIED payment stays VERIFIED); RETURNED status alone removes it from revenue.
  A `REFUNDED` PaymentStatus can be added later without touching the predicate.
- **No Manufacturing change on return.** The unit was built (build-to-order); there
  is no inventory restore in v1. Keeping it consistent means leaving it untouched.
- **No stored revenue.** The dashboard sums orders matching the predicate on every
  read, so the figure is always consistent with current state — no double-counting,
  no reconciliation. `Order` gains only `returnedAt` / `returnReason` (record-keeping,
  not revenue state).

**Why derived over stored:** a stored revenue flag or ledger would have to be kept
in sync on every status/payment transition (deliver, return, cancel, re-verify),
which is exactly where drift and double-counting bugs live. Deriving from the two
facts that actually define revenue (payment received; order not returned/cancelled)
makes every transition automatically correct and keeps the rule in one auditable
place.

**Dashboard:** `revenue` is now Σ`total` over the predicate ("Recognized revenue",
replacing the old DELIVERED-only sum); `returnedOrders` (count) and `returnedValue`
(Σ`total` over RETURNED = reversed revenue) are surfaced beside it.

**Revisit if:** we add a `REFUNDED` payment status / actual refund flow, want
inventory restore on return, need revenue recognised at a different point (e.g.
shipment), or the derived query becomes a performance concern at scale (would add a
maintained aggregate, not change the rule).

---

## ADR-019: placeOrder transaction scope + serverless notification dispatch

**Date:** 2026-07-15 (Phase J production hotfix)

**Context:** Two production-only failures in the checkout path, both invisible
locally because `next dev` runs a long-lived Node process on a same-host DB
(~1ms round-trips, no function freeze):

- **P2024** — the after-commit notification hooks were fire-and-forget
  `void notify...(orderNumber)`, and each re-queried the order via
  `prisma.order.findUnique()`. On Vercel the function is frozen the instant the
  201 response returns, so that un-awaited query was orphaned on a suspended
  function and timed out acquiring a connection from Prisma's internal pool.
- **P2028 "Transaction not found"** — `placeOrder`'s interactive `$transaction`
  ran on Prisma's default 5000ms timeout. Vercel (US) ↔ Neon (Singapore,
  ADR-011) round-trips are cross-region (~6–9 sequential per placement, plus a
  Neon serverless cold-wake) and exceeded 5s; Prisma then closes the tx and the
  next `tx.*` call — `cartItem.deleteMany`, the last op — throws P2028, rolling
  back the whole order so NO order was created. It surfaced right after the
  P2024 fix because that widened `order.create`'s select with a `user` relation
  load, nudging borderline transactions over the 5s edge.

**Decision:**

(a) **Notifications receive a plain pre-built payload — no post-commit
re-query.** `placeOrder` builds an `OrderNotification` (plain serializable data)
from what its transaction already computed, and the senders do zero DB reads.
Dispatch is via `next/server` **`after()`** — it runs the send after the
response is flushed and keeps the serverless function alive until it finishes,
so nothing is orphaned and zero latency is added to checkout. Still best-effort:
each sender is try/caught, logs its own failure, never throws, never blocks or
rolls back an order. Admin-triggered hooks that don't hold the order data use a
`withOrderNotification(orderNumber, send)` helper — one plain read, awaited
inside `after()` so it too is never orphaned.

(b) **placeOrder's transaction options raised** from Prisma's defaults
(`maxWait: 2000`, `timeout: 5000`) to **`{ maxWait: 5000, timeout: 15000 }`** —
15s covers the worst realistic cross-region + cold-wake case with headroom while
still bounding a genuinely stuck transaction; the 5s maxWait tolerates a cold
connection acquisition.

(c) **The cart read and the address ownership check moved OUTSIDE the
transaction** (read once, before the orderNumber-retry loop), along with their
pure derivations (line items, subtotal, delivery charge, initial status, address
snapshot). Everything requiring atomicity stays inside the transaction: the
coupon `SELECT … FOR UPDATE` lock + counts + validation (ADR-017 race-safety),
the total computation, the order + items + payment + status-history nested
create with JSON snapshots, the coupon redemption insert, and the cart clear
(`cartItem.deleteMany`).

**Tradeoff (explicit):** moving those reads out introduces a small **TOCTOU
window** — the cart and its prices are read a few hundred ms before commit, so a
concurrent cart change in another tab could be missed by the order that then
clears the whole cart. Accepted: the window is tiny, single-user self-races on
one cart during a single checkout are not a real threat, and everything that
requires atomicity (writes + the coupon row-lock + cart clear) remains inside
the transaction. **Revisit if** concurrent-tab cart edits ever cause real
issues (would reintroduce a transactional cart read or a cart-row lock).

**Unchanged:** ADR-005 (server-side price computation — totals are still
recomputed server-side from live DB prices, client-sent totals ignored), the
idempotency design (`Order.idempotencyKey` unique + fast-path + unique-violation
race handling), and the ADR-004 JSON snapshots (address + product frozen at
`order.create`). No checkout business logic changed.

**Verified** locally over the full HTTP stack (real customer JWT sessions):
prepaid+coupon and COD placements → 201; cart cleared; server-side pricing
(injected body totals ignored); snapshot immutability (order address unchanged
after the saved address was edited); idempotent replay → same order + exactly
one coupon redemption; coupon cap → 409; ownership → 404; best-effort
notifications (forced throw → order still 201, error logged via `after()`); COD
gate (no Manufacturing row, PENDING payment). No P2028, no 500s.

**Secondary hardening (Vercel env, no repo change):** append
`connect_timeout=15&pool_timeout=15` to the production `DATABASE_URL`; consider
Neon's pooled (`-pooler`) endpoint with `pgbouncer=true` if connection
contention recurs. This is compounding-latency insurance only — (b)+(c) are the
actual cure.

---

## ADR-020: Rate limiting — Postgres fixed-window, fail-open, dual ip+email keys on the sensitive auth surfaces

**Date:** 2026-07-16 (Phase J.3 Part A)

**Decision:** Rate limiting is a single Postgres table (`RateLimit`: `key` PK,
`count`, `expiresAt`) driven by `src/lib/rate-limit.ts`, applied to the auth,
password-reset, coupon-validate, contact, and customer-upload surfaces. No Redis,
no external service — one table reused everywhere (including the Part D error-alert
throttle).

**Algorithm — fixed window.** Each `key` owns one row with a `count` and the
window's `expiresAt`. The increment is a SINGLE atomic
`INSERT … ON CONFLICT DO UPDATE` that increments-or-resets and RETURNs the new
count in one round-trip — never read-then-write (which races), so two concurrent
requests can never both slip past the limit. Fixed window can allow up to ~2× the
limit across a window boundary; accepted — the goal is stopping brute force and
abuse, not precise metering, and sliding-window/token-bucket cost materially more
for no launch benefit.

**Fail-OPEN.** Every limiter DB call is wrapped so that on ANY error it ALLOWS the
request and logs. A rate limiter must never become the outage — a Neon blip or
pool timeout must not lock everyone out of a live store. (Verified: with the table
renamed away, all requests were allowed, not 429/500, and logged.)

**Per-endpoint limits** (generous for humans, tight on abuse), 429 + `Retry-After`,
generic body (never reveals whether an account/coupon/email exists):

| Surface | Key(s) | Limit |
|---|---|---|
| Admin login | ip AND email | 5 / 15 min |
| Customer login | ip | 10 / 15 min |
| Register | ip | 5 / hour |
| forgot-password | ip AND email | 3 / hour |
| reset-password | ip | 10 / hour |
| coupons/validate | userId | 20 / hour |
| Contact | ip | 5 / hour |
| Payment-proof submit | userId | 10 / hour |
| Payment-proof Cloudinary sign | userId | 30 / hour |
| Order placement | — | none (idempotency already prevents double-orders; blocking a real order is a lost sale) |

**Dual ip+email on forgot-password AND admin login (both keys must pass).**
IP-only doesn't stop an attacker email-bombing one victim's inbox from many
addresses, nor a distributed admin brute-force from many IPs — the email key
closes both. Accepted trade-off: the email key enables a targeted 15-minute
account-lockout DoS (fail 5× on a known admin email), taken deliberately because
admin-password brute force (→ change the bKash/Nagad receiving numbers in
settings → every subsequent customer pays the attacker) is the far worse outcome
this phase exists to prevent.

**Login is Auth.js, not a `/api/v1` route,** so limiting lives in a WRAPPER around
the credentials-callback `POST` (`src/app/api/auth/[...nextauth]/route.ts`): PEEK
the limit before delegating (a real 429 + Retry-After), then record only FAILED
attempts (no session cookie set) — so a legitimate admin's successful logins never
consume budget, while an attacker's failed guesses are capped. The wrapper reads
the body once and reconstructs a `NextRequest` for Auth.js (cloning + reading a
Request body is unreliable — it can lock the original stream), and is fail-open:
any wrapper error falls through to the normal handler.

**Client IP on Vercel:** the leftmost entry of `x-forwarded-for` (Vercel puts the
real client there), falling back to `x-real-ip`, then a constant bucket.

**Cleanup:** ~1% of limited requests fire a bounded, best-effort sweep of expired
rows so the table can't grow forever.

**Revisit if:** we outgrow one Postgres table (move to Redis/Upstash), need
sliding-window precision, want Vercel WAF edge rules as a complement (IP-only —
can't express the email/userId keys, so it complements rather than replaces this),
or add a per-account temporary-lockout that survives the fixed window.
