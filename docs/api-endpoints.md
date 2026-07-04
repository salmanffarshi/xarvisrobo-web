# Xarvisrobo API Reference (v1)

Base path: `/api/v1/*`
Auth handled by **Auth.js (NextAuth v5)** at `/api/auth/*` (separate from v1).
The future mobile app consumes the same `/api/v1/*` endpoints — never call server actions directly for anything the mobile app will need.

---

## Conventions

- **Method semantics:** `GET` reads, `POST` creates, `PATCH` partial update, `DELETE` removes. Full-body `PUT` is not used.
- **Pagination (list endpoints):** `?page=1&limit=20` (max limit 100). Response includes `{ data, page, limit, total, totalPages }`.
- **Filtering:** query params (`?status=CONFIRMED&search=xr-2026`). Combinable.
- **Sorting:** `?sort=createdAt&order=desc`.
- **Errors:** always `{ error: { code, message, details? } }` with proper HTTP status.
- **Timestamps:** ISO 8601 UTC strings on the wire.
- **Money:** decimals as strings (e.g. `"1250.00"`) to avoid float precision issues.
- **IDs:** `cuid()` strings from Prisma.
- **Order lookup:** by `orderNumber` (human-readable) in URLs, not internal `id`.
- **Idempotency on POST /orders:** client sends `Idempotency-Key` header to prevent double-order on double-click.
- **Rate limits:** public endpoints (contact, register, login) rate-limited by IP.
- **CORS:** locked to app origin; mobile app added later via allow-list.

## Auth contexts

Two isolated session cookies. Middleware in `/middleware.ts` enforces:

| Path prefix | Required session | Allowed roles |
|---|---|---|
| `/api/v1/products`, `/api/v1/categories`, `/api/v1/contact`, `/api/v1/auth/*` | none | public |
| `/api/v1/me/*`, `/api/v1/cart/*`, `/api/v1/orders/*` | customer | CUSTOMER |
| `/api/v1/admin/*` | admin | ADMIN, MANAGER, ENGINEER, QC, SUPPORT (route-level checks refine) |

A customer session never grants admin access. An admin session never grants customer commerce actions. Even if the same email exists as both (unusual, but possible), the sessions are separate.

---

## Auth (public)

Auth.js handles sign-in flow itself. These are the flows we wire up:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/callback/credentials` | Auth.js — customer login |
| POST | `/api/v1/auth/register` | Create CUSTOMER account |
| POST | `/api/v1/auth/password/reset-request` | Send password reset email |
| POST | `/api/v1/auth/password/reset-confirm` | Complete reset with token |
| POST | `/api/v1/auth/verify-email` | Confirm email via token |
| GET  | `/api/v1/auth/me` | Current customer session info |

Admin login is separate:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/callback/admin-credentials` | Auth.js — admin login (separate provider) |
| GET  | `/api/v1/admin/auth/me` | Current admin session info |

---

## Customer — profile & addresses

| Method | Path | Purpose |
|---|---|---|
| GET   | `/api/v1/me` | Get current customer profile |
| PATCH | `/api/v1/me` | Update name, phone |
| POST  | `/api/v1/me/password` | Change password (requires old password) |
| GET   | `/api/v1/me/addresses` | List addresses |
| POST  | `/api/v1/me/addresses` | Add address |
| GET   | `/api/v1/me/addresses/:id` | Get single address |
| PATCH | `/api/v1/me/addresses/:id` | Update address |
| DELETE| `/api/v1/me/addresses/:id` | Delete address |
| POST  | `/api/v1/me/addresses/:id/default` | Set as default |

---

## Public catalog

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/products` | List active products. Filters: `search`, `category`, `featured`, `minPrice`, `maxPrice`, `sort` |
| GET | `/api/v1/products/:slug` | Product detail (only if `isActive`) |
| GET | `/api/v1/categories` | List categories (nested tree) |
| GET | `/api/v1/categories/:slug` | Category detail |

---

## Cart

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/v1/cart` | Get current cart |
| POST   | `/api/v1/cart/items` | Add item `{ productId, quantity }` |
| PATCH  | `/api/v1/cart/items/:itemId` | Update quantity |
| DELETE | `/api/v1/cart/items/:itemId` | Remove item |
| DELETE | `/api/v1/cart` | Clear cart |

Cart persists per user. Server always recomputes totals — never trust client-sent totals.

---

## Orders (customer)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/v1/me/orders` | List customer's orders (paginated) |
| GET  | `/api/v1/me/orders/:orderNumber` | Order detail (customer view — no manufacturing internals) |
| POST | `/api/v1/orders` | Place order from cart. Body: `{ addressId, contactPhone, deliveryNotes, paymentMethod }`. Requires `Idempotency-Key` header. |
| POST | `/api/v1/orders/:orderNumber/payment` | Submit payment info (bKash/Nagad/Bank). Body: `{ transactionId, senderNumber, paidAmount, screenshotUrl? }` |
| POST | `/api/v1/orders/:orderNumber/cancel` | Cancel (only allowed before status = IN_PRODUCTION) |

**Order placement logic (server-side):**
1. Validate cart is non-empty.
2. Compute subtotal from server-side product prices (never client prices).
3. Add `130` BDT `deliveryCharge` if `paymentMethod === COD`, else `0`.
4. Snapshot shipping address → `Order.shippingAddress` JSON.
5. Snapshot each product → `OrderItem.productSnapshot` JSON.
6. Generate `orderNumber` (e.g., `XR-2026-0001`).
7. Set initial status: `AWAITING_PAYMENT_VERIFICATION` for bKash/Nagad/Bank, `CONFIRMED` for COD.
8. Create `Manufacturing` row with `WAITING_FOR_PRODUCTION`.
9. Clear cart.
10. Send email notification.

---

## Contact

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/contact` | Public contact form submission |

---

## Notifications

| Method | Path | Purpose |
|---|---|---|
| GET   | `/api/v1/me/notifications` | List notifications (paginated, filter by `unread`) |
| PATCH | `/api/v1/me/notifications/:id/read` | Mark one as read |
| POST  | `/api/v1/me/notifications/read-all` | Mark all as read |

---

## Uploads

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/uploads/image` | Upload image → returns `{ url }` from Cloudinary. Used by product admin (product images) and customer (payment screenshot). Auth required — role-based path scoping. |

---

# ADMIN ENDPOINTS

All under `/api/v1/admin/*`. Require admin session. Individual routes further restrict by role.

## Dashboard

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard/stats` | Totals: orders, pending payments, pending orders, manufacturing counts, sales summary | ADMIN, MANAGER |

## Product management

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/products` | List all (incl. inactive), filters | ADMIN, MANAGER |
| POST   | `/api/v1/admin/products` | Create product | ADMIN, MANAGER |
| GET    | `/api/v1/admin/products/:id` | Product detail | ADMIN, MANAGER |
| PATCH  | `/api/v1/admin/products/:id` | Update fields, stock | ADMIN, MANAGER |
| DELETE | `/api/v1/admin/products/:id` | Soft delete (`isActive=false`); hard delete blocked if orders exist | ADMIN |
| POST   | `/api/v1/admin/products/:id/images` | Add image | ADMIN, MANAGER |
| PATCH  | `/api/v1/admin/products/:id/images/:imageId` | Reorder, set primary | ADMIN, MANAGER |
| DELETE | `/api/v1/admin/products/:id/images/:imageId` | Remove image | ADMIN, MANAGER |

## Category management

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/categories` | List | ADMIN, MANAGER |
| POST   | `/api/v1/admin/categories` | Create | ADMIN, MANAGER |
| PATCH  | `/api/v1/admin/categories/:id` | Update | ADMIN, MANAGER |
| DELETE | `/api/v1/admin/categories/:id` | Delete (blocked if products attached) | ADMIN |

## Customer management

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/customers` | List, search by name/email/phone | ADMIN, MANAGER, SUPPORT |
| GET    | `/api/v1/admin/customers/:id` | Customer profile | ADMIN, MANAGER, SUPPORT |
| GET    | `/api/v1/admin/customers/:id/orders` | Customer's order history | ADMIN, MANAGER, SUPPORT |
| GET    | `/api/v1/admin/customers/:id/notes` | Internal notes | ADMIN, MANAGER, SUPPORT |
| POST   | `/api/v1/admin/customers/:id/notes` | Add internal note | ADMIN, MANAGER, SUPPORT |
| DELETE | `/api/v1/admin/customers/:id/notes/:noteId` | Delete note (author or ADMIN only) | ADMIN, author |
| PATCH  | `/api/v1/admin/customers/:id/deactivate` | Deactivate account | ADMIN |

## Payment verification

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET  | `/api/v1/admin/payments` | Queue: filter by `status=PENDING` | ADMIN, MANAGER |
| GET  | `/api/v1/admin/payments/:id` | Payment detail (with order + screenshot) | ADMIN, MANAGER |
| POST | `/api/v1/admin/payments/:id/verify` | Mark VERIFIED → sets order status to PAYMENT_VERIFIED → notification | ADMIN, MANAGER |
| POST | `/api/v1/admin/payments/:id/reject` | Body: `{ reason }`. Notifies customer. | ADMIN, MANAGER |
| POST | `/api/v1/admin/payments/:id/request-info` | Body: `{ message }`. Sets INFO_REQUESTED, notifies customer. | ADMIN, MANAGER |

## Order management

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/orders` | List, filter by `status`, `paymentMethod`, `dateFrom`, `dateTo`, `search` | ADMIN, MANAGER, SUPPORT |
| GET    | `/api/v1/admin/orders/:orderNumber` | Full order detail (incl. payment + manufacturing) | ADMIN, MANAGER, SUPPORT |
| PATCH  | `/api/v1/admin/orders/:orderNumber/status` | Manually transition customer-facing status | ADMIN, MANAGER |
| POST   | `/api/v1/admin/orders/:orderNumber/cancel` | Cancel with reason | ADMIN, MANAGER |
| GET    | `/api/v1/admin/orders/:orderNumber/history` | Full status change audit trail | ADMIN, MANAGER, SUPPORT |

## Manufacturing (internal)

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/manufacturing` | Board view: all orders currently in production, grouped by internalStatus | ADMIN, MANAGER, ENGINEER, QC |
| GET    | `/api/v1/admin/manufacturing/:orderNumber` | Manufacturing detail for one order | ADMIN, MANAGER, ENGINEER, QC |
| PATCH  | `/api/v1/admin/manufacturing/:orderNumber/stage` | Move to next stage `{ internalStatus }` | ADMIN, MANAGER, ENGINEER, QC |
| PATCH  | `/api/v1/admin/manufacturing/:orderNumber/assign` | Assign an engineer | ADMIN, MANAGER |
| POST   | `/api/v1/admin/manufacturing/:orderNumber/notes` | Append note | ADMIN, MANAGER, ENGINEER, QC |

When `internalStatus` moves to `READY_TO_SHIP`, backend does NOT auto-transition customer-facing status — that's a separate admin action (`orders/:orderNumber/status`) so shipping label prep is deliberate.

## Staff management

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET    | `/api/v1/admin/users` | List staff (roles != CUSTOMER) | ADMIN |
| POST   | `/api/v1/admin/users` | Create staff account | ADMIN |
| PATCH  | `/api/v1/admin/users/:id` | Update name, phone | ADMIN |
| PATCH  | `/api/v1/admin/users/:id/role` | Change role | ADMIN |
| PATCH  | `/api/v1/admin/users/:id/deactivate` | Deactivate | ADMIN |

## Contact messages

| Method | Path | Purpose | Roles |
|---|---|---|---|
| GET   | `/api/v1/admin/contact-messages` | List, filter by `isResolved` | ADMIN, SUPPORT |
| PATCH | `/api/v1/admin/contact-messages/:id/resolve` | Mark resolved | ADMIN, SUPPORT |

---

## Health / system

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | `{ status: "ok" }` — for uptime monitoring |

---

## Service layer mapping (business logic)

Every non-trivial API route should call a function in `/src/services/`, not put logic inside the route. This is what makes it mobile-app-reusable.

| API route | Service function |
|---|---|
| `POST /orders` | `orderService.placeOrder(userId, input)` |
| `POST /orders/:n/payment` | `paymentService.submitPayment(userId, orderNumber, input)` |
| `POST /admin/payments/:id/verify` | `paymentService.verify(adminId, paymentId)` |
| `PATCH /admin/orders/:n/status` | `orderService.transitionStatus(adminId, orderNumber, to, note)` |
| `PATCH /admin/manufacturing/:n/stage` | `manufacturingService.moveStage(adminId, orderNumber, to)` |

Route handlers = HTTP glue only. All rules, validation, DB writes, notifications live in services.
