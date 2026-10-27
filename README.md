# EasyBook

Table reservations with a refundable deposit, built for restaurants that still take bookings over phone and WhatsApp.

**Live app:** https://[client-url]  ·  **API:** https://[api-url]/api/health  ·  **Demo video:** [link]

**Demo logins** (test data): owner `owner@demo.com` (password is whatever `SEED_OWNER_PASSWORD` you set when seeding) and a diner account you register yourself. Add the credentials you choose here before submitting.

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

## Performance Notes

- **Fewer database round trips:** menu and availability each run one parallel round trip, and availability never writes on a read. Logged-in requests reuse the user for 30 seconds instead of re-reading it.
- **Smaller responses:** JSON is gzipped, and public restaurant data is cacheable for 30 seconds. Private and fast-changing responses (bookings, availability, auth) are never cached.
- **Instant navigation:** the frontend keeps public data in a short in-memory cache, shows it immediately and refreshes in the background. Hovering a restaurant card starts loading its page. Pages show skeleton placeholders instead of a blank spinner, and owner pages load on demand.
- **Deploy near your database:** each database call is one network round trip. Put the Render service in the same region as the Atlas cluster (Mumbai or Singapore for Indian users). Render's free tier also sleeps when idle, so the first request after a quiet period can take about 30 seconds.
- **Login is per tab:** each browser tab keeps its own session, so you can stay logged in as an owner in one tab and a diner in another.

## Load Testing

`cd backend && npm run loadtest` starts a throwaway copy of the API (temporary in-memory MongoDB with the real 200-restaurant seed, no rate limiter, mock payments) and drives it with [autocannon](https://github.com/mcollina/autocannon). It never touches the real database or Razorpay. `DURATION` and `CONNECTIONS` set the length and concurrency.

Results on a laptop, 50 connections, 8 s per scenario, no network latency to a hosted database:

| Scenario | req/s | p50 | p99 | Failed |
|---|---|---|---|---|
| Restaurant list / search | 5,900 / 8,500 | 8 ms / 5 ms | 13 ms / 8 ms | 0 |
| Restaurant detail / menu | 14,000 / 6,900 | 3 ms / 7 ms | 5 ms / 10 ms | 0 |
| Availability | 6,600 | 7 ms | 10 ms | 0 |
| Token check, my bookings | 18,000 / 8,300 | 2 ms / 5 ms | 3 ms / 7 ms | 0 |
| Owner dashboard / reservations | 5,600 / 6,500 | 8 ms / 7 ms | 14 ms / 17 ms | 0 |
| Login (bcrypt, 20 connections) | 20 | 1,089 ms | 4,235 ms | 0 |
| Mixed browsing | 6,600 | 6 ms | 10 ms | 0 |

At 200 connections nothing failed and p99 stayed under 70 ms for reads. **No double booking under a race:** 150 diners booking the same slot at the same instant produced exactly 1, 5 and 20 bookings for 1, 5 and 20 tables, and every other request got a clean 409.

Known limits: password hashing (bcrypt, cost 10) is the slowest path at about 20 logins per second and briefly occupies the server while it runs. The login rate limiter (20 attempts per 15 minutes per client) protects it. In production the real limits are the hosted database (Atlas free tier: 100 connections) and the network round trip to it, not the app.

## Local Setup

Requires Node 20+ and a MongoDB (local or Atlas).

```bash
git clone [repo-url] && cd EasyBook
cd backend && cp .env.example .env     # fill in MONGO_URI and JWT_SECRET
npm install && npm run dev            # API on http://localhost:5000
cd ../frontend && cp .env.example .env
npm install && npm run dev            # app on http://localhost:5173
```

Run the tests: `cd backend && npm test` (downloads an in-memory MongoDB on first run). Coverage: `npm run coverage`.

## Seed Data (Bangalore restaurants and menus)

So the app is not empty on first open, a seed script imports real Bangalore restaurants and gives each tables and a sample menu.

```bash
cd backend
npm run seed          # imports up to 200 restaurants from the committed snapshot into the database in backend/.env
npm run seed:fetch    # optional: refresh the snapshot from OpenStreetMap (needs internet)
```

- **Idempotent:** run it as often as you like. Existing restaurants are never duplicated, and menus an owner has edited are never overwritten.
- **Demo owner:** all seeded restaurants belong to `owner@demo.com`. `SEED_OWNER_PASSWORD` (8+ characters, set in `backend/.env`) is **required**: there is no default, because this account can cancel bookings and mark no-shows at every seeded restaurant. That email cannot be registered through the app. To change the password later run `npm run seed -- --reset-owner-password`.
- **Privacy:** the snapshot keeps only name, cuisine and address tags. Phone numbers, emails and other contact tags from OpenStreetMap are stripped, and `npm run seed:fetch` strips them too.
- **Re-seeding:** a restaurant that already has tables or menu items is left alone. If you delete every dish or table of a seeded restaurant, the next seed adds the sample ones back, and an interrupted run can leave a restaurant with only some of its tables, so clear that restaurant's tables or menu items before re-running.
- **What is real:** restaurant names, addresses and cuisine tags come from OpenStreetMap. Neighbourhood tags are sparse in the source data, so most listings show only the street or city.
- **What is sample data:** opening hours (11:00 to 23:00), tables (4 to 6 per restaurant) and **menus**. Menus are generic dishes for the cuisine, shown with a "Sample menu" banner. They are not any restaurant's actual menu. An owner who edits a dish makes it their own.
- **Photos:** restaurant cards and pages show illustrative stock photos (food matched to cuisine, plus some dining rooms), picked from the restaurant id so each keeps the same photo. They are **not** pictures of the restaurants. They come from Wikimedia Commons under CC0 / CC BY / CC BY-SA licences, are stored in `frontend/public/covers`, and are credited on the in-app **Photo credits** page (`/credits`).
- **Attribution:** Restaurant data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [ODbL](https://opendatacommons.org/licenses/odbl/).

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI` | backend | MongoDB connection string |
| `JWT_SECRET` | backend | Signs login tokens (required in production) |
| `JWT_EXPIRES_IN` | backend | Token lifetime, default `7d` |
| `CLIENT_ORIGIN` | backend | Allowed CORS origin(s), comma separated |
| `GATEWAY` | backend | `mock` (no keys needed) or `razorpay` |
| `ALLOW_MOCK_GATEWAY` | backend | Must be `true` to run `GATEWAY=mock` with `NODE_ENV=production`. Demo only: the mock gateway lets any diner "pay" for free |
| `MOCK_GATEWAY_SECRET` | backend | Signing secret for the mock gateway |
| `SEED_OWNER_PASSWORD` | backend | Required by `npm run seed`: password for the demo owner `owner@demo.com` (8+ characters, your choice) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | backend | Razorpay test-mode credentials, required when `GATEWAY=razorpay` |
| `VITE_API_URL` | frontend | API base URL, e.g. `https://[api-url]/api` |

## Deployment

- **Database:** MongoDB Atlas free cluster.
- **Backend:** Render web service, root `backend`, build `npm install`, start `npm start`.
- **Frontend:** Vercel, root `frontend`, framework Vite.
- Razorpay webhook (when `GATEWAY=razorpay`): `https://[api-url]/api/payments/webhook`, event `payment.captured`.
- The free Render tier sleeps when idle. Hold expiry is also checked lazily on every read, so correctness does not depend on the background job.
