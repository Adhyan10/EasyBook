# Bangalore Seed and Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox syntax. Every task is test-first: write the listed tests, run them and watch them fail, implement, run to green, commit.

**Goal:** Add menu items per restaurant and a seed script that imports Bangalore restaurants from an OpenStreetMap snapshot with tables and sample menus.

**Architecture:** New `MenuItem` model with public read and owner-only writes, following the table pattern. A pure seed library (`backend/src/seed/`) maps OSM elements to restaurants, picks a sample menu template by cuisine and derives a deterministic table layout. A DB runner applies them idempotently. Thin CLI scripts read a committed snapshot.

**Tech Stack:** unchanged (Express 4, Mongoose, zod, Vitest, React).

**Spec:** `docs/superpowers/specs/2026-10-24-bangalore-seed-and-menu-design.md` (extends `2026-10-24-easybook-design.md`)

## Global Constraints

- Same constraints as the base plan: ESM, Express 4, envelope `{ success, data, error }`, files under 400 lines, no `console.log` in `src/` (CLI scripts under `scripts/` may print summaries with `process.stdout.write`), commits `<type>: <description>` ending with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Folders are `backend/` and `frontend/`. Run backend commands from `backend/`.
- Seed cap 200 restaurants. Demo owner `owner@demo.com`, password from `SEED_OWNER_PASSWORD` (default `<demo-password>`).
- Seeded data: `isSample: true` on restaurants and menu items; never overwrite anything an owner edited.
- Price: integer rupees 1 to 100000. Category 1-40 chars, name 1-80, description max 200.

## Review Focus

1. **Seed run twice** must not duplicate restaurants, tables or menu items. (Task 4)
2. **Owner-edited menu survives a re-seed**, including a deleted item not coming back. (Task 4)
3. **OSM elements with no name, duplicate ids, missing tags** must be skipped or defaulted, never crash the run. (Task 3)
4. **Another owner editing or deleting a menu item** must get 403; a malformed id 400. (Task 2)
5. **Editing a sample item** clears its sample flag so the "Sample menu" banner stays truthful. (Task 2)

## File Structure

```
backend/
  scripts/        seed.js  fetchOsm.js  data/bangalore-osm.json
  src/
    models/       MenuItem.js            (new)    Restaurant.js (modify)
    validation/   menuSchemas.js         (new)    restaurantSchemas.js (modify)
    services/     menuView.js            (new)
    controllers/  menuController.js      (new)    restaurantController.js (modify)
    routes/       menuRoutes.js          (new)    index.js (modify)
    seed/         cuisine.js  menuTemplates.js  tableLayout.js  osmMapper.js  runSeed.js
  tests/          unit/{menuView,cuisine,tableLayout,osmMapper,menuTemplates}.test.js
                  integration/{menu,restaurantsArea,seed}.test.js  fixtures/osm-sample.json
frontend/src/
  components/Menu.jsx  (new)   Layout.jsx (modify: footer)
  pages/ManageMenu.jsx (new)   RestaurantDetail.jsx, Browse.jsx, OwnerDashboard.jsx (modify)
  lib/format.js (modify)  App.jsx (modify)
```

---

### Task 1: Restaurant fields: area, source, externalId, isSample

**Files:** Modify `backend/src/models/Restaurant.js`, `backend/src/validation/restaurantSchemas.js`, `backend/src/controllers/restaurantController.js`. Test: `backend/tests/integration/restaurantsArea.test.js`.

**Interfaces:** Produces `Restaurant` with optional `area` (string, max 60, default `''`), `source` (`'owner'|'osm'`, default `'owner'`), `externalId` (string, unique sparse), `isSample` (boolean, default false). Owner create/update bodies accept optional `area`. `GET /restaurants?q=` matches `name` OR `area`.

- [ ] **Step 1: Write failing tests** in `restaurantsArea.test.js` (setup like `restaurants.test.js`):
  - owner POST `/api/restaurants` with `area: 'Indiranagar'` returns 201, `data.area === 'Indiranagar'`, `data.source === 'owner'`, `data.isSample === false`.
  - `GET /api/restaurants?q=indira` returns the restaurant whose `area` is "Indiranagar" even though its name does not contain "indira" (case-insensitive); a restaurant with neither is excluded.
  - `GET /api/restaurants?q=Cafe (` still treats regex characters literally (no 500).
  - two restaurants created through the model with the same `externalId` reject with code 11000; two restaurants with no `externalId` are both allowed.
- [ ] **Step 2:** `cd backend && npx vitest run tests/integration/restaurantsArea.test.js` → FAIL (area undefined / q does not match area).
- [ ] **Step 3: Implement.** Model: add the four fields and `restaurantSchema.index({ externalId: 1 }, { unique: true, sparse: true })`. Schemas: add `area: z.string().trim().max(60).optional()` to `base`. Controller list filter: replace the `q` clause with `$or: [{ name: re }, { area: re }]` using the existing escaped regex, only when `q` is present.
- [ ] **Step 4:** run the new file plus `tests/integration/restaurants.test.js` → PASS.
- [ ] **Step 5: Commit** `feat: add area, source and sample flags to restaurants`.

---

### Task 2: Menu model, API and view helper

**Files:** Create `backend/src/models/MenuItem.js`, `backend/src/validation/menuSchemas.js`, `backend/src/services/menuView.js`, `backend/src/controllers/menuController.js`, `backend/src/routes/menuRoutes.js`. Modify `backend/src/routes/index.js`, `backend/tests/helpers/factories.js` (add `createMenuItem(restaurant, overrides)` with defaults `category: 'Mains'`, `name: 'Item N'`, `price: 100`). Tests: `backend/tests/unit/menuView.test.js`, `backend/tests/integration/menu.test.js`.

**Interfaces:**
- `MenuItem { restaurant, category, name, description, price, isVeg, isSample }`.
- `groupMenu(items): { isSample: boolean, categories: Array<{ name: string, items: object[] }> }` pure. Categories keep first-seen order; items keep input order; `isSample` is true only when `items.length > 0` and every item has `isSample`.
- `GET /api/restaurants/:id/menu` public. `POST /api/restaurants/:id/menu` owner, body `{ category, name, description?, price, isVeg? }` → 201 item. `PATCH /api/menu-items/:id` owner, partial body (non-empty), sets `isSample: false`. `DELETE /api/menu-items/:id` owner → `{ deleted: true }`.

- [ ] **Step 1: Write failing tests.**
  - `menuView.test.js`: empty list → `{ isSample: false, categories: [] }`; items across categories "Starters","Mains","Starters" group as Starters(2 items in order), Mains(1); all sample → `isSample` true; one non-sample item → false.
  - `menu.test.js` (owner, restaurant, `createUser`, `authHeader`):
    - public GET returns grouped menu with no auth; 404 for unknown restaurant id; 400 for `/restaurants/nope/menu`.
    - owner POST adds an item (201), response has `price`, `isVeg: true` default, `isSample: false`.
    - POST rejects (400): price `0`, `-5`, `12.5`, `"50"`, `100001`; empty name; name of 81 chars; missing category.
    - diner POST → 403; anonymous → 401; other owner POST → 403.
    - PATCH by owner changes price and, for an item created with `isSample: true`, returns `isSample: false`; empty body → 400; other owner → 403; unknown id → 404; malformed id → 400.
    - DELETE by owner removes it (subsequent GET omits it); other owner → 403.
- [ ] **Step 2:** `npx vitest run tests/unit/menuView.test.js tests/integration/menu.test.js` → FAIL (modules/routes missing).
- [ ] **Step 3: Implement** following the `Table` pattern: model with validators from the constraints above (integer price via validator), indexes `{ restaurant: 1, category: 1 }`; zod `createMenuItemBody` and `updateMenuItemBody` (`partial().refine(non-empty)`); controller using `getOwnedRestaurant` and a `getOwnedItem` helper (find item → 404, then `getOwnedRestaurant(item.restaurant, userId)`); `getMenu` loads items sorted by `createdAt` then `_id`, returns `groupMenu(items)`; routes use `requireAuth`, `requireRole(ROLES.OWNER)`, `validate({ params: idParam, body })`; mount in `routes/index.js`.
- [ ] **Step 4:** run the two files, then the whole suite → PASS.
- [ ] **Step 5: Commit** `feat: add restaurant menus with owner management`.

---

### Task 3: Seed library: cuisine, menu templates, table layout, OSM mapper

**Files:** Create `backend/src/seed/cuisine.js`, `menuTemplates.js`, `tableLayout.js`, `osmMapper.js`. Tests: `backend/tests/unit/{cuisine,menuTemplates,tableLayout,osmMapper}.test.js`.

**Interfaces:**
- `pickTemplate(cuisineTag: string): 'south_indian'|'north_indian'|'biryani'|'chinese'|'cafe'|'multi'`. Uses the first `;`-separated value, lowercased, substring rules checked in this order: south (`south_indian`, `udupi`, `dosa`, `idli`, `kerala`, `andhra`, `karnataka`, `tamil`) → biryani (`biryani`, `hyderabadi`, `mughlai`, `kebab`, `awadhi`) → chinese (`chinese`, `asian`, `thai`, `momo`, `tibetan`, `noodle`) → cafe (`cafe`, `coffee`, `bakery`, `dessert`, `ice_cream`, `tea`, `sandwich`, `pizza`, `burger`, `italian`) → north (`north_indian`, `punjabi`, `tandoori`, `indian`) → else `multi`.
- `titleCaseCuisine(tag: string): string`: first `;` value, `_` → space, capitalise each word; empty → `'Multi-cuisine'`.
- `MENU_TEMPLATES: Record<templateKey, Array<{ category, name, price, isVeg }>>`: six keys, 12 items each, at least 3 distinct categories per template, prices integers 20-900, every item name unique within its template.
- `hashString(text): number`, `tableLayoutFor(externalId): Array<{ label, seats }>`: 4 to 6 tables labelled `T1..Tn`, seats from `[2,4,6,8]`, deterministic, includes at least one table of 2 and one of 4.
- `mapOsmElement(element): object | null` returning `{ externalId: 'node/123', name, area, address, cuisine, cuisineKey, city: 'Bangalore', openTime: '11:00', closeTime: '23:00', slotMinutes: 60, source: 'osm', isSample: true }`; `null` when there is no non-blank `tags.name`, or no `type`/`id`. Area from `addr:suburb` else `addr:neighbourhood` else `''`; address = `housenumber street` then area, joined with `, `, default `'Bangalore'`; strings trimmed and clipped to name 80, area 60, address 160, cuisine 40.

- [ ] **Step 1: Write failing tests.**
  - `cuisine.test.js`: table-driven `pickTemplate` cases: `south_indian`→south_indian, `Udupi`→south_indian, `biryani`→biryani, `chinese;thai`→chinese (first value only), `coffee_shop`→cafe, `pizza`→cafe, `punjabi`→north_indian, `indian`→north_indian, `regional`→multi, `''`→multi, `undefined`→multi; `titleCaseCuisine('south_indian')`→`'South Indian'`, `''`→`'Multi-cuisine'`, `'chinese;thai'`→`'Chinese'`.
  - `menuTemplates.test.js`: six keys exist; each has exactly 12 items, ≥3 categories, unique names, integer prices in range, boolean `isVeg`.
  - `tableLayout.test.js`: same id gives identical output twice; 200 generated ids all give 4-6 tables, labels sequential, seats within allowed set, ≥1 table with 2 seats and ≥1 with 4 seats; at least two different layouts appear across the 200 ids.
  - `osmMapper.test.js`: full element (`type: 'node', id: 1`, tags name, `addr:suburb`, `addr:street`, `addr:housenumber`, `cuisine: 'south_indian'`) maps to expected object; no name → null; blank name `'  '` → null; missing `id` → null; `addr:neighbourhood` used when suburb absent; no address tags → address `'Bangalore'` and area `''`; 120-char name clipped to 80; `type: 'way', id: 9` → `externalId: 'way/9'`.
- [ ] **Step 2:** run the four files → FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules to the interfaces above. `menuTemplates.js` holds generic dishes only (e.g. south: Masala Dosa, Idli Vada, Filter Coffee; north: Paneer Butter Masala, Butter Naan, Dal Makhani; biryani: Chicken Dum Biryani, Veg Biryani, Raita; chinese: Veg Hakka Noodles, Manchow Soup, Gobi Manchurian; cafe: Cappuccino, Veg Sandwich, Brownie; multi: a mix), with INR prices typical for casual dining.
- [ ] **Step 4:** run the four files → PASS.
- [ ] **Step 5: Commit** `feat: add seed library for Bangalore restaurants and sample menus`.

---

### Task 4: Seed runner (idempotent) and CLI scripts

**Files:** Create `backend/src/seed/runSeed.js`, `backend/scripts/seed.js`, `backend/scripts/fetchOsm.js`, `backend/tests/fixtures/osm-sample.json`. Modify `backend/package.json` (scripts `seed`, `seed:fetch`), `backend/.env.example` (add `SEED_OWNER_PASSWORD=<demo-password>`). Test: `backend/tests/integration/seed.test.js`.

**Interfaces:** `runSeed({ elements, ownerPassword = '<demo-password>', limit = 200 }): Promise<{ restaurantsCreated, restaurantsExisting, tablesCreated, menuItemsCreated }>`. Demo owner `owner@demo.com` role `owner` is created if missing (never re-hashed or modified if present). Existing restaurants (matched by `externalId`) are left untouched; tables and menu items are created only for restaurants that have none.

- [ ] **Step 1: Write failing tests** with fixture `osm-sample.json` = array of 5 elements: two valid named restaurants (`node/1` south_indian, `way/2` chinese), one duplicate of `node/1`, one with no name, one valid with no cuisine tag (`node/3`). In `seed.test.js` (in-memory DB):
  - first run summary is `{ restaurantsCreated: 3, restaurantsExisting: 0, tablesCreated: T, menuItemsCreated: 36 }` where `T` equals the sum of `tableLayoutFor` lengths for the three ids; DB counts match; demo owner exists with role owner and owns all three; every created restaurant has `source: 'osm'`, `isSample: true`, city `Bangalore`; menu items all `isSample: true`.
  - second run returns `restaurantsCreated: 0, restaurantsExisting: 3, tablesCreated: 0, menuItemsCreated: 0` and DB counts are unchanged (Review Focus 1).
  - after run 1, edit one item's price via the model (set `isSample: false`) and delete another item of the same restaurant; run 2 leaves the edited price and does not recreate the deleted item; that restaurant's menu count is 11 (Review Focus 2).
  - `limit: 2` creates only two restaurants.
  - a restaurant whose tables were all removed by the owner gets no new tables on re-seed? No: tables are only created when the restaurant has none, so the test asserts the documented behaviour: zero tables → tables are recreated. Assert exactly that.
  - running with an empty `elements` array returns all-zero summary and still creates the demo owner.
- [ ] **Step 2:** `npx vitest run tests/integration/seed.test.js` → FAIL.
- [ ] **Step 3: Implement** `runSeed.js`: `upsertDemoOwner(password)` (bcrypt cost from constants), map → drop nulls → de-duplicate by `externalId` (first wins) → `slice(0, limit)`; per record: find by `externalId` or `Restaurant.create({ ...fields, owner })` (strip `cuisineKey`); `ensureTables` (insertMany layout if `Table.countDocuments({ restaurant }) === 0`); `ensureMenu` (insertMany template items with `restaurant` and `isSample: true` if `MenuItem.countDocuments({ restaurant }) === 0`). `scripts/seed.js`: load `src/config/env.js`, read `scripts/data/bangalore-osm.json` (`{ elements }`), fail with a clear message when `MONGO_URI` is missing or the file is unreadable, `connectDb()`, `runSeed`, print the summary with `process.stdout.write`, disconnect. `scripts/fetchOsm.js`: POST an Overpass query for `amenity=restaurant` with a `name` tag inside the Bengaluru administrative area (`out center tags 600;`) to `https://overpass-api.de/api/interpreter`, write `{ fetchedAt, source: 'OpenStreetMap contributors (ODbL)', elements }` to the snapshot path; exit non-zero with a clear message on HTTP or JSON errors.
- [ ] **Step 4:** run `tests/integration/seed.test.js` then the whole backend suite → PASS.
- [ ] **Step 5: Commit** `feat: add idempotent Bangalore seed runner and scripts`.

---

### Task 5: Fetch the real snapshot and dry-run the seed

**Files:** Create `backend/scripts/data/bangalore-osm.json`. No new tests (data task); verification is command output.

- [ ] **Step 1:** `cd backend && npm run seed:fetch`. Expected: prints the element count (aim for at least 100) and writes the snapshot. If Overpass rejects or times out, retry with a smaller `out` limit or an alternative public Overpass instance; if all fail, stop and report.
- [ ] **Step 2: Inspect.** Count elements with a name, distinct cuisines and how many have `addr:suburb`; confirm the file is under 2 MB. Spot-check that no personal data beyond business names and addresses is present.
- [ ] **Step 3: Dry-run mapping** (no database): a one-off `node -e` that imports `mapOsmElement` and `pickTemplate`, maps the snapshot and prints counts per template and how many were skipped. Expected: at least 80 mapped restaurants.
- [ ] **Step 4: Commit** `chore: add Bangalore OpenStreetMap snapshot`.

---

### Task 6: Frontend: menu section, owner menu page, area in browse, footer

**Files:** Create `frontend/src/components/Menu.jsx`, `frontend/src/pages/ManageMenu.jsx`. Modify `frontend/src/pages/RestaurantDetail.jsx`, `frontend/src/pages/Browse.jsx`, `frontend/src/pages/OwnerDashboard.jsx`, `frontend/src/components/Layout.jsx`, `frontend/src/App.jsx`, `frontend/src/styles.css`.

**Interfaces:** `<Menu restaurantId />` loads `GET /restaurants/:id/menu` and renders categories with item name, description, veg marker, price (`rupees`), a "Sample menu" banner when `isSample`, loading and empty states ("This restaurant has not added a menu yet."). Route `/owner/restaurants/:id/menu` (owner only). Browse cards show `area` after the city. Footer text: "Restaurant data © OpenStreetMap contributors (ODbL). Seeded menus, tables and hours are sample data."

- [ ] **Step 1:** Implement `Menu.jsx` and render it under the description in `RestaurantDetail.jsx`.
- [ ] **Step 2:** Implement `ManageMenu.jsx`: list items grouped by category with edit (inline price and name), delete (confirm), and an add form (category, name, price, veg checkbox); errors shown in `ErrorBanner`; after any change reload. Add a "Menu" link per restaurant in `OwnerDashboard.jsx` and the route in `App.jsx`.
- [ ] **Step 3:** Show `area` in Browse cards; update the placeholder to mention area; add the footer to `Layout.jsx`; add minimal styles (veg dot, menu rows, footer).
- [ ] **Step 4:** `cd frontend && npm run build` → success.
- [ ] **Step 5: Manual check** against the running API: seed a restaurant with the fixture-free path (create one as owner), add menu items, view as diner, edit an item, confirm the banner logic with a seeded restaurant after Task 7.
- [ ] **Step 6: Commit** `feat: add menu section, owner menu page and area display`.

---

### Task 7: Docs, full verification and handoff

**Files:** Modify `README.md`, `docs/superpowers/specs/2026-10-24-easybook-design.md` (note pointing to the addendum).

- [ ] **Step 1:** README: new "Seed data" section (commands `npm run seed:fetch`, `npm run seed`, `SEED_OWNER_PASSWORD`, demo owner login, what is real vs sample, OpenStreetMap attribution and ODbL link, that the seed writes to the database named in `backend/.env`). Update the demo-logins line.
- [ ] **Step 2:** Run the full backend suite with coverage (`npx vitest run --coverage`); services and controllers stay at or above 80%. Build the frontend.
- [ ] **Step 3:** Commit `docs: document Bangalore seed data and menus`.
- [ ] **Step 4 (needs the user):** the user runs `cd backend && npm run seed` against their own Atlas database (it writes about 200 restaurants, 1,000 tables and 2,400 menu items). Then verify in the browser: Browse shows Bangalore restaurants with areas; opening one shows a sample menu with the banner; booking works end to end on a seeded restaurant; logging in as `owner@demo.com` lists them under My restaurants.
