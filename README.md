# EasyBook

Table reservations with a refundable deposit, built for restaurants that still take bookings over phone and WhatsApp.

**Live app:** https://[client-url]  ·  **API:** https://[api-url]/api/health  ·  **Demo video:** [link]

**Demo logins** (test data): owner `owner@demo.com` / `password123`, diner `diner@demo.com` / `password123`

## Problem Statement

Small restaurants take reservations by phone and chat. That causes double-bookings, no-shows that cost them real revenue, and no single view of the day's reservations.

## Target Users

- **Diners** who want a guaranteed table at a specific time without calling.
- **Restaurant owners** who want conflict-free bookings, fewer no-shows, and a daily reservation list.

## Solution

Owners publish their tables and opening hours. Diners pick a date, party size and time slot. The server assigns the smallest free table that fits and holds it for 10 minutes while the diner pays a ₹25-per-person deposit. The deposit is refunded for cancellations made 2+ hours ahead, kept by the restaurant on no-shows and late cancellations, and adjusted against the bill when the guests are seated.

## Key Features

1. **Owner setup:** create restaurants, set hours and slot length, manage tables (enable, disable, delete).
2. **Search and book:** filter restaurants, see live availability for a party size, book with automatic table assignment.
3. **Deposit payment:** 10-minute table hold with countdown, signature-verified payment (verify + webhook), automatic expiry and automatic refund if a late payment finds the slot taken.
4. **Lifecycle:** diner cancellation with refund policy, owner marks seated / completed / no-show / cancelled, owner adjusts the deposit at billing, deposits ledger.

## Tech Stack

React 18 + Vite · Node + Express 4 · MongoDB (Atlas) + Mongoose · JWT + bcrypt · zod · Razorpay (test mode, with a mock gateway fallback) · Vitest + Supertest.

## Architecture

```
React client ──HTTPS──> Express API ──> MongoDB
                         │   ├─ controllers (thin HTTP layer)
                         │   ├─ services    (pure rules: slots, availability, refund policy, state machine)
                         │   └─ gateway     (Razorpay / mock adapter)
                         └─ hold-expiry job (every 60s, plus lazy expiry on reads)
```

- **No double-booking:** slots sit on a fixed grid, so two bookings conflict only when `(table, date, slotStart)` match. A MongoDB **partial unique index** over active statuses enforces this atomically. When two diners race, one insert fails with a duplicate key error, the API tries the next-smallest table and finally returns 409.
- **Deposit safety:** amount computed on the server (`₹25 × guests`), payment claimed atomically so verify and webhook cannot double-process, late payments on a taken slot are refunded automatically.
- **Booking state machine:** `pending_payment → confirmed → seated → completed`, plus `expired`, `cancelled`, `no_show`. Illegal transitions return 409.
- **Deliberate simplification:** fixed slot length per restaurant (no custom stay durations).
- **Payout model:** the platform collects deposits (Razorpay test mode) and a ledger records what each restaurant is owed until the owner adjusts it at billing. Real split payouts (Razorpay Route + KYC) are out of scope.

## Local Setup

Requires Node 20+ and a MongoDB (local or Atlas).

```bash
git clone [repo-url] && cd EasyBook
cd server && cp .env.example .env     # fill in MONGO_URI and JWT_SECRET
npm install && npm run dev            # API on http://localhost:5000
cd ../client && cp .env.example .env
npm install && npm run dev            # app on http://localhost:5173
```

Run the tests: `cd server && npm test` (downloads an in-memory MongoDB on first run). Coverage: `npm run coverage`.

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI` | server | MongoDB connection string |
| `JWT_SECRET` | server | Signs login tokens (required in production) |
| `JWT_EXPIRES_IN` | server | Token lifetime, default `7d` |
| `CLIENT_ORIGIN` | server | Allowed CORS origin(s), comma separated |
| `GATEWAY` | server | `mock` (no keys needed) or `razorpay` |
| `MOCK_GATEWAY_SECRET` | server | Signing secret for the mock gateway |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | server | Razorpay test-mode credentials, required when `GATEWAY=razorpay` |
| `VITE_API_URL` | client | API base URL, e.g. `https://[api-url]/api` |

## Deployment

- **Database:** MongoDB Atlas free cluster.
- **API:** Render web service, root `server`, build `npm install`, start `npm start`.
- **Client:** Vercel, root `client`, framework Vite.
- Razorpay webhook (when `GATEWAY=razorpay`): `https://[api-url]/api/payments/webhook`, event `payment.captured`.
- The free Render tier sleeps when idle. Hold expiry is also checked lazily on every read, so correctness does not depend on the background job.
