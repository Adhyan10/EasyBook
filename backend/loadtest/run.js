// Load test against a throwaway copy of the app: temporary in-memory MongoDB, the real 200-restaurant
// seed, no rate limiter, mock payments. It never touches your Atlas database or Razorpay account.
//
//   cd backend && npm run loadtest            (default: 8 seconds per scenario)
//   DURATION=15 CONNECTIONS=100 npm run loadtest
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'loadtest-secret';
process.env.GATEWAY = 'mock';
process.env.MOCK_GATEWAY_SECRET = 'loadtest-mock';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION ?? '7.0.14';

const { readFile } = await import('node:fs/promises');
const autocannon = (await import('autocannon')).default;
const bcrypt = (await import('bcryptjs')).default;
const mongoose = (await import('mongoose')).default;
const { MongoMemoryServer } = await import('mongodb-memory-server');
const { createApp } = await import('../src/app.js');
const { BCRYPT_ROUNDS } = await import('../src/constants.js');
const { Restaurant } = await import('../src/models/Restaurant.js');
const { Table } = await import('../src/models/Table.js');
const { User } = await import('../src/models/User.js');
const { runSeed } = await import('../src/seed/runSeed.js');
const { signToken } = await import('../src/utils/jwt.js');

const DURATION = Number(process.env.DURATION ?? 8);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 50);
const DINERS = 150;
const out = (text = '') => process.stdout.write(`${text}\n`);
const pad = (value, width) => String(value).padEnd(width);
const ms = (value) => `${Number(value).toFixed(0)}ms`;

async function startServer() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'loadtest', maxPoolSize: 20, minPoolSize: 5 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const snapshot = JSON.parse(await readFile(new URL('../scripts/data/bangalore-osm.json', import.meta.url), 'utf8'));
  const seed = await runSeed({ elements: snapshot.elements, ownerPassword: 'loadtest-owner-1' });

  const loginHash = await bcrypt.hash('loadtest-pass-1', BCRYPT_ROUNDS);
  const quickHash = await bcrypt.hash('x', 4);
  await User.create({ name: 'Login Diner', email: 'login.diner@example.com', passwordHash: loginHash, role: 'diner' });
  const diners = await User.insertMany(
    Array.from({ length: DINERS }, (_, i) => ({ name: `Diner ${i}`, email: `diner${i}@example.com`, passwordHash: quickHash, role: 'diner' })),
  );
  const owner = await User.findOne({ email: 'owner@demo.com' });

  const server = createApp({ rateLimit: null }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { mongod, server, seed, owner, diners, base: `http://127.0.0.1:${server.address().port}` };
}

async function run(title, options) {
  const result = await autocannon({ duration: DURATION, connections: CONNECTIONS, ...options });
  return { title, result };
}

function row({ title, result }) {
  const ok = result['2xx'];
  const bad = result.non2xx + result.errors + result.timeouts;
  return `${pad(title, 34)}${pad(Math.round(result.requests.average), 9)}${pad(ms(result.latency.p50), 9)}${pad(ms(result.latency.p97_5 ?? result.latency.p99), 9)}${pad(ms(result.latency.p99), 9)}${pad(ms(result.latency.max), 9)}${pad(ok, 9)}${bad}`;
}

async function bookingRace(ctx, restaurantCount) {
  const { base, diners } = ctx;
  const restaurant = await Restaurant.create({
    owner: ctx.owner._id, name: `Race ${restaurantCount}`, cuisine: 'Test', city: 'Bangalore', address: 'x',
    openTime: '12:00', closeTime: '23:00', slotMinutes: 60,
  });
  await Table.insertMany(Array.from({ length: restaurantCount }, (_, i) => ({ restaurant: restaurant._id, label: `T${i + 1}`, seats: 4 })));
  const attempts = diners.map((diner) =>
    fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken(diner)}` },
      body: JSON.stringify({ restaurantId: String(restaurant._id), date: '2099-06-15', slotStart: '19:00', partySize: 2 }),
    }).then((res) => res.status),
  );
  const statuses = await Promise.all(attempts);
  const count = (code) => statuses.filter((s) => s === code).length;
  return { tables: restaurantCount, diners: diners.length, created: count(201), taken: count(409), other: statuses.length - count(201) - count(409) };
}

const ctx = await startServer();
out(`EasyBook load test | ${DURATION}s per scenario, ${CONNECTIONS} connections | seeded ${ctx.seed.restaurantsCreated} restaurants, ${ctx.seed.tablesCreated} tables, ${ctx.seed.menuItemsCreated} menu items`);
out('In-memory MongoDB on this machine: no network latency to a hosted database. Read the numbers as app throughput, not as production speed.');
out();

const restaurants = await Restaurant.find({ source: 'osm' }).limit(40).select('_id').lean();
const ids = restaurants.map((r) => String(r._id));
const dinerAuth = { Authorization: `Bearer ${signToken(ctx.diners[0])}` };
const ownerAuth = { Authorization: `Bearer ${signToken(ctx.owner)}` };
const date = '2026-12-01';
const paths = (build) => ids.map((id) => ({ method: 'GET', path: build(id) }));

const scenarios = [
  ['Restaurant list (page of 12)', { url: `${ctx.base}/api/restaurants?limit=12` }],
  ['Restaurant search (q=masala)', { url: `${ctx.base}/api/restaurants?q=masala&limit=12` }],
  ['Restaurant detail', { url: ctx.base, requests: paths((id) => `/api/restaurants/${id}`) }],
  ['Menu', { url: ctx.base, requests: paths((id) => `/api/restaurants/${id}/menu`) }],
  ['Availability', { url: ctx.base, requests: paths((id) => `/api/restaurants/${id}/availability?date=${date}&partySize=2`) }],
  ['Auth: /auth/me (token check)', { url: `${ctx.base}/api/auth/me`, headers: dinerAuth }],
  ['Diner: my bookings', { url: `${ctx.base}/api/bookings/mine`, headers: dinerAuth }],
  ['Owner dashboard (page of 10)', { url: `${ctx.base}/api/restaurants/mine?limit=10`, headers: ownerAuth }],
  ['Owner reservations (day view)', { url: ctx.base, headers: ownerAuth, requests: paths((id) => `/api/restaurants/${id}/bookings?date=${date}`) }],
  ['Login (bcrypt, 20 connections)', {
    url: `${ctx.base}/api/auth/login`, connections: 20, method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'login.diner@example.com', password: 'loadtest-pass-1' }),
  }],
  ['Mixed browsing (list/detail/menu/avail)', {
    url: ctx.base,
    requests: [
      { method: 'GET', path: '/api/restaurants?limit=12' },
      ...ids.slice(0, 10).flatMap((id) => [
        { method: 'GET', path: `/api/restaurants/${id}` },
        { method: 'GET', path: `/api/restaurants/${id}/menu` },
        { method: 'GET', path: `/api/restaurants/${id}/availability?date=${date}&partySize=2` },
      ]),
    ],
  }],
];

const results = [];
out(pad('Scenario', 34) + pad('req/s', 9) + pad('p50', 9) + pad('p97.5', 9) + pad('p99', 9) + pad('max', 9) + pad('2xx', 9) + 'failed');
out('-'.repeat(95));
for (const [title, options] of scenarios) {
  const entry = await run(title, options);
  results.push(entry);
  out(row(entry));
}

out();
out('Booking race: many diners book the SAME 19:00 slot at the same instant (no double booking allowed)');
for (const tables of [1, 5, 20]) {
  const r = await bookingRace(ctx, tables);
  const correct = r.created === tables && r.other === 0;
  out(`  ${pad(`${r.tables} table(s), ${r.diners} diners`, 28)} booked ${pad(r.created, 4)} taken(409) ${pad(r.taken, 4)} unexpected ${pad(r.other, 3)} ${correct ? 'PASS' : 'FAIL'}`);
  if (!correct) process.exitCode = 1;
}

const unhealthy = results.filter(({ result }) => result.non2xx + result.errors + result.timeouts > 0);
out();
out(unhealthy.length ? `Scenarios with failures: ${unhealthy.map((u) => u.title).join(', ')}` : 'No failed requests in any scenario.');

ctx.server.close();
await mongoose.disconnect();
await ctx.mongod.stop();
