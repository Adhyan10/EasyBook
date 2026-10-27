# EasyBook: Bangalore Seed and Menus, Design Spec

Date: 2026-10-24
Extends: `2026-10-24-easybook-design.md`
Deadline unchanged: 2026-10-27 23:59 IST

## 1. Goal

Make the deployed app feel alive on first open: a few hundred real Bangalore restaurants (from OpenStreetMap) with bookable tables, plus a menu per restaurant. Restaurant owners can still sign up and add their own restaurants as before.

## 2. Scope

### In
1. **Menu feature:** menu items per restaurant, public read, owner edit.
2. **Seed script:** `npm run seed` imports Bangalore restaurants from an OpenStreetMap snapshot, creates tables and sample menus.
3. **Attribution:** README and app footer credit OpenStreetMap contributors (ODbL).

### Out (YAGNI)
Menu images, categories managed as entities, dietary filters, ordering or payments for food, live OSM sync, hours parsed from OSM `opening_hours`, claiming a seeded listing as an owner.

### Honesty rule
Seeded menus are **generic dishes per cuisine**, never claims about a named restaurant. Every seeded item and the UI mark them as "Sample menu". Opening hours, tables and menus of seeded restaurants are placeholder data and the README says so.

## 3. Data Model Changes

### restaurants (new optional fields)
| Field | Type | Notes |
|---|---|---|
| `area` | String | locality, default empty |
| `source` | `owner` \| `osm` | default `owner` |
| `externalId` | String | OSM id, e.g. `node/123`; unique sparse |
| `isSample` | Boolean | true for seeded restaurants, default false |

`description` stays optional. Seeded restaurants use the same schedule rules as any restaurant (`openTime`, `closeTime`, `slotMinutes`).

### menuitems (new collection)
| Field | Type | Notes |
|---|---|---|
| `restaurant` | ObjectId | indexed |
| `category` | String | 1-40 chars, e.g. "Starters" |
| `name` | String | 1-80 chars |
| `description` | String | optional, max 200 |
| `price` | Number | integer rupees, 1-100000 |
| `isVeg` | Boolean | default true |
| `isSample` | Boolean | true for seeded items; cleared when an owner edits the item |

Indexes: `{ restaurant: 1, category: 1 }`; `restaurants.externalId` unique sparse.

## 4. API

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/restaurants/:id/menu` | public | `{ isSample, categories: [{ name, items: [...] }] }`. `isSample` is true only when every item is a sample. |
| POST | `/restaurants/:id/menu` | owner of it | add an item |
| PATCH | `/menu-items/:id` | owner of it | edit an item (sets `isSample=false`) |
| DELETE | `/menu-items/:id` | owner of it | remove an item |

Errors follow the existing map: 400 invalid input or malformed id, 401, 403 not the owner, 404 not found. `GET /restaurants` list also returns `area` and `isSample`, and its `q` filter additionally matches `area`.

## 5. Seed Script

**Command:** `cd backend && npm run seed` (reads `backend/.env`).

**Inputs**
- `backend/scripts/data/bangalore-osm.json`: committed snapshot of Overpass API results for `amenity=restaurant` inside the Bangalore administrative area. A separate command, `npm run seed:fetch`, refreshes the snapshot from the Overpass API. `seed` never calls the network.
- Env `SEED_OWNER_PASSWORD` (default `<demo-password>`, demo only).

**Behaviour**
1. Upsert the demo owner `owner@demo.com`.
2. Take elements that have a `name`, de-duplicate by OSM id, cap at 200.
3. Map each to a restaurant: `name`, `area` (`addr:suburb` or `addr:neighbourhood`, else "Bangalore"), `address` (street parts if present, else area, else "Bangalore"), `cuisine` (first OSM `cuisine` tag value, title-cased, else "Multi-cuisine"), `city` "Bangalore", `openTime` 11:00, `closeTime` 23:00, `slotMinutes` 60, `source` osm, `externalId`, `isSample` true.
4. Create 4-6 tables per restaurant with a layout derived from a hash of `externalId`, so reruns produce the same tables.
5. Attach a sample menu chosen by cuisine template: South Indian, North Indian, Chinese, Cafe and bakery, Biryani and Mughlai, Multi-cuisine (default). About 12 items each.
6. **Idempotent:** restaurants match on `externalId`; existing restaurants and their tables are not duplicated; menus are only added to restaurants that have no menu items. Owner-edited data is never overwritten.
7. Prints a summary (restaurants created, skipped, tables, items). Fails with a clear message if `MONGO_URI` is missing or the snapshot is unreadable.

## 6. Frontend

- **Restaurant page:** a Menu section listing categories and items (name, price, veg marker). When `isSample`, a banner says "Sample menu: generic dishes for this cuisine, not this restaurant's actual menu".
- **Owner menu page:** `/owner/restaurants/:id/menu`, linked from the owner dashboard. Add, edit and delete items with loading, empty and error states.
- **Browse:** shows `area`; search also matches area.
- **Footer:** "Restaurant data © OpenStreetMap contributors (ODbL)".

## 7. Security

Menu writes use the existing ownership check. Seed credentials come from env, never hardcoded beyond the documented demo default. The seed creates no secrets and is run manually by the maintainer.

## 8. Testing (test-first)

- **Unit:** OSM element to restaurant mapping (missing tags, suburb vs neighbourhood, cuisine casing), cuisine to template choice, deterministic table layout, menu grouping.
- **Integration:** menu API (public read, owner-only writes, other owner 403, malformed id 400, price and name validation, editing clears `isSample`); seed run twice against the in-memory database with a small fixture yields the same counts and preserves an owner-edited menu.
- Coverage stays at or above 80% on services and controllers.

## 9. Build Order

1. Menu model, validation, routes, tests (backend).
2. Seed library: mapper, templates, table layout, tests.
3. Seed script and fetch script, idempotency tests, snapshot committed.
4. Frontend: menu section, owner menu page, browse area, footer.
5. README (seed instructions, attribution, honesty note) and a final check against the real database.

Estimated half a day. The booking, payment and deposit code is not modified.

## 10. Risks

- **Overpass API availability or rate limits:** mitigated by the committed snapshot; only `seed:fetch` needs the network.
- **Sparse OSM data:** many entries lack cuisine or address; defaults cover this and the README states the data is partial.
- **Public demo owner login:** anyone with the demo credentials can edit seeded menus. Acceptable for a demo; set `SEED_OWNER_PASSWORD` in any shared deployment.
