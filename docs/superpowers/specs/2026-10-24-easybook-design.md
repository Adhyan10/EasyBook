# EasyBook — Design Spec

Date: 2026-10-24
Deadline: 2026-10-27 23:59 IST (end-term submission)

## 1. Problem and Users

**Problem:** Restaurants take table reservations over phone and WhatsApp. Result: double-bookings, no-shows with no cost, and no single view of the day's reservations.

**Users**
- **Diner:** finds a restaurant, books a table for a date/time/party size, pays a refundable deposit, can cancel.
- **Owner:** registers a restaurant, defines tables and hours, manages the day's reservations, adjusts the deposit against the final bill.

**Why software:** conflict-safe booking, automatic table assignment, deposit with refund rules and expiring holds are error-prone to do manually.

## 2. Scope

### Workflows (4)
1. **Owner setup:** create restaurant, set opening hours and slot length, add/edit/disable tables.
2. **Search and book:** diner searches restaurants, sees availability for date + party size, books; server auto-assigns the smallest free table that fits.
3. **Deposit payment:** ₹25 per person, held slot for 10 minutes, verified by signature and webhook, expires if unpaid.
4. **Lifecycle:** cancel with refund policy, owner marks seated / completed / no-show, owner adjusts the deposit against the bill.

### Out of scope (YAGNI)
Reviews, maps, real-time updates, custom stay lengths, real payouts to restaurants (see 6.4), social login, multiple currencies.

### Deliberate simplification
Slots sit on a fixed grid: `openTime + n × slotMinutes`. Overlap therefore reduces to equality of `(table, date, slotStart)`, which a unique index can enforce. Documented in the README.

## 3. Stack

- Backend: Node, Express, Mongoose, MongoDB Atlas
- Frontend: React + Vite
- Auth: JWT, bcrypt
- Validation: zod
- Security: helmet, CORS allow-list, express-rate-limit
- Payments: Razorpay test mode behind a gateway adapter (mock adapter as fallback)
- Tests: Vitest (unit for services), Supertest (API integration)
- Deploy: Render (API), Vercel or Netlify (client), Atlas (DB)

## 4. Data Model

### users
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique, lowercase |
| passwordHash | String | bcrypt |
| role | `diner` \| `owner` | required |

### restaurants
| Field | Type | Notes |
|---|---|---|
| owner | ObjectId → users | |
| name, cuisine, city, address, description | String | search fields |
| openTime, closeTime | String `HH:mm` | closeTime > openTime |
| slotMinutes | Number | 30–180 |
| depositPerPerson | Number | default 25 (INR), server constant |

### tables
| Field | Type | Notes |
|---|---|---|
| restaurant | ObjectId | |
| label | String | unique per restaurant |
| seats | Number | ≥ 1 |
| isActive | Boolean | default true |

### bookings
| Field | Type | Notes |
|---|---|---|
| restaurant, table, diner | ObjectId | |
| date | String `YYYY-MM-DD` | restaurant-local date |
| slotStart | String `HH:mm` | on the slot grid |
| partySize | Number | ≥ 1 |
| status | enum | see 5 |
| holdExpiresAt | Date | set while `pending_payment` |

### payments
| Field | Type | Notes |
|---|---|---|
| booking | ObjectId | one payment per booking |
| amount | Number | `25 × partySize`, computed server-side |
| gatewayOrderId, gatewayPaymentId | String | |
| status | `created` \| `paid` \| `failed` \| `refunded` \| `forfeited` | |
| adjustedAt | Date | set when owner adjusts at billing |

### Indexes
- `users.email` unique
- `restaurants`: `{ city, cuisine }`
- `tables`: `{ restaurant, label }` unique
- `bookings`: **partial unique** `{ table, date, slotStart }` where `status ∈ {pending_payment, confirmed, seated}`
- `bookings`: `{ restaurant, date }`, `{ diner, date }`
- `payments`: `{ gatewayPaymentId }` unique sparse

## 5. Booking State Machine

```
pending_payment -> confirmed   (payment verified)
pending_payment -> expired     (10 min hold timeout, or payment failed)
confirmed       -> seated -> completed
confirmed       -> no_show
confirmed       -> cancelled   (diner or owner)
```

Any other transition returns 409. Transition rules live in one pure function. `expired`, `cancelled`, `no_show`, `completed` drop out of the unique index, which frees the slot.

## 6. Core Logic

### 6.1 Slot grid
`generateSlots(openTime, closeTime, slotMinutes)` returns all `HH:mm` starts where `start + slotMinutes <= closeTime`.

### 6.2 Availability
For `(restaurant, date, partySize)`: generate slots; load active tables with `seats >= partySize`; load active bookings for that date; a slot is available if at least one fitting table has no active booking at that slotStart. Past slots (restaurant-local time) are unavailable.

### 6.3 Create booking
1. Validate input. Reject past slot (422), off-grid or outside hours (422).
2. Candidate tables: active, `seats >= partySize`, ascending by seats. None: 422 "Party too large".
3. For each candidate: try insert as `pending_payment` with `holdExpiresAt = now + 10 min`. Duplicate key (11000): try next. All fail: 409.
4. Create payment record (`amount = 25 × partySize`) and gateway order. If order creation fails, delete the booking and return 502 with a retry message.
5. Return 201 with booking, table label, order details.

### 6.4 Deposit and payout model
Platform collects via Razorpay **test mode**. A ledger records that the deposit is owed to the restaurant until the owner adjusts it at billing. Real split payouts (Razorpay Route + KYC) are out of scope; stated plainly in the README.

### 6.5 Payment confirmation
- `POST /payments/verify`: verify HMAC signature, then confirm booking.
- `POST /payments/webhook`: verify webhook signature, same confirm path. Idempotent on `gatewayPaymentId`.
- If payment arrives after the hold expired and the slot is still free: confirm. If the slot is gone: auto-refund and respond with explanation.
- Amount or signature mismatch: 400, logged.

### 6.6 Hold expiry
A job runs every 60 seconds: set `pending_payment` bookings with `holdExpiresAt < now` to `expired`, payment to `failed`. Also checked lazily on read so correctness does not depend on the job.

### 6.7 Refund policy
`refundPolicy(slotDateTime, now, cancelledBy)`:

| Event | Result |
|---|---|
| Diner cancels ≥ 2h before slot | refund full |
| Diner cancels < 2h before slot | forfeit (owner credit) |
| Owner cancels | refund full |
| No-show | forfeit |

### 6.8 Adjustment at billing
Owner marks a `seated` or `completed` booking's deposit as adjusted: sets `adjustedAt`. Only payments with status `paid` can be adjusted. Refunded, forfeited, or already-adjusted payments return 409. Forfeited deposits (no-show, late cancel) are kept by the restaurant and appear in the ledger as forfeited, not adjusted.

## 7. API

Base `/api`. Envelope: `{ success, data, error }`. Auth: `Authorization: Bearer <JWT>`.

### Auth
- `POST /auth/register` public
- `POST /auth/login` public
- `GET /auth/me` any

### Restaurants
- `GET /restaurants?city=&cuisine=&q=&page=&limit=` public
- `GET /restaurants/:id` public
- `GET /restaurants/mine` owner
- `POST /restaurants` owner
- `PATCH /restaurants/:id` owner of it

### Tables
- `GET /restaurants/:id/tables` owner of it
- `POST /restaurants/:id/tables` owner of it
- `PATCH /tables/:id` owner of it
- `DELETE /tables/:id` owner of it; 409 if future active bookings

### Booking
- `GET /restaurants/:id/availability?date=&partySize=` public
- `POST /bookings` diner
- `GET /bookings/mine` diner
- `PATCH /bookings/:id/cancel` diner who owns it
- `GET /restaurants/:id/bookings?date=` owner of it
- `PATCH /bookings/:id/status` owner of it (seated, completed, no_show, cancelled)
- `PATCH /bookings/:id/adjust` owner of it

### Payments
- `POST /payments/verify` diner who owns the booking
- `POST /payments/webhook` gateway only (signature-verified, raw body)
- `GET /restaurants/:id/deposits` owner of it (collected, adjusted, pending, refunded)

### Error codes
| Code | When |
|---|---|
| 400 | invalid input, bad signature or amount |
| 401 | missing or invalid token |
| 403 | wrong role or not the owner of the resource |
| 404 | not found |
| 409 | slot taken, invalid transition, table has future bookings, double adjust |
| 422 | party too large, past slot, outside hours or off-grid |
| 429 | rate limit |
| 502 | payment gateway failure |
| 500 | unexpected; detail logged server-side, generic message to client |

## 8. Architecture

```
server/
  src/
    config/       db.js, env.js
    models/       User, Restaurant, Table, Booking, Payment
    controllers/  auth, restaurant, table, booking, payment
    routes/       auth, restaurant, table, booking, payment
    middleware/   auth, role, loadOwnedRestaurant, validate, errorHandler
    services/     slots, availability, bookingService, refundPolicy,
                  bookingStateMachine, holdExpiry
    gateway/      razorpayGateway.js, mockGateway.js, index.js
    utils/        AppError.js
  tests/
client/ (React + Vite)
  pages: Login, Register, Browse, RestaurantDetail (book + pay), MyBookings,
         OwnerDashboard, ManageTables, DayReservations, Deposits
```

Business logic sits in `services/` as pure functions with injected `now`, so it is testable without a database. Controllers stay thin. The gateway adapter exposes `createOrder`, `verifySignature`, `refund`.

## 9. Security

- Passwords: bcrypt cost 10. JWT secret and gateway keys only in env. `.env.example` committed, `.env` ignored.
- Deposit amount computed on the server only.
- Ownership enforced by middleware on every owner route.
- Webhook uses raw body and signature check.
- helmet, CORS allow-list, rate limit (stricter on `/auth`), zod validation on all input.
- Error responses never leak stack traces or internals.

## 10. UX States

Every page handles loading, empty, success and error states. Booking page shows a countdown for the 10-minute hold. Clear messages for "slot just taken", "hold expired", and refund outcomes.

## 11. Testing

- **Unit (Vitest):** slot generation, availability, refund policy, state machine, hold expiry, deposit amount.
- **Integration (Supertest + in-memory Mongo):** concurrent booking of the same slot yields exactly one success; auth and ownership 401/403; payment verify/webhook idempotency; expiry frees the slot.
- Target 80% coverage on `services/` and controllers.

## 12. Build Order (3 days)

- **Day 1 (24 Oct):** repo, server scaffold, models, auth, restaurants, tables, slots + availability with tests. Commit per feature.
- **Day 2 (25–26 Oct):** booking + hold + gateway adapter + payments + refund/lifecycle + adjust; React pages for diner and owner flows.
- **Day 3 (27 Oct):** error/empty states, deploy (Atlas, Render, Vercel), README, demo video, incognito link check, submit form.

Cut first if behind: webhook (keep verify), deposits ledger page, email.

## 13. Submission Checklist

Mapped from the end-term guidelines: working deployment, README with all required sections, `.env.example`, no secrets in git, meaningful commit history, demo video 3–5 min, form submitted before the deadline.

## 14. Implementation Notes (deviations from the sections above)

- `payments` also stores `restaurant` so the deposits ledger is a single query.
- Payment status adds `refund_failed` for refunds the gateway rejected; the ledger surfaces these for manual follow-up.
- Ownership checks are a service (`getOwnedRestaurant`) used by controllers instead of a `loadOwnedRestaurant` middleware.
- `POST /payments/mock-pay` exists only when `GATEWAY=mock`; it returns a valid test signature so the demo works without Razorpay keys.
- A diner re-booking the same slot releases their own abandoned pending hold first.
- Owners may cancel a booking after its slot has started (full refund); marking `no_show` requires the slot to have started.
- Changing a restaurant's opening hours or slot length is blocked (409) while upcoming active bookings exist.
- Deleting a table is blocked (409) only when it has upcoming active bookings; past bookings keep a null table reference and the UI shows "Removed".
