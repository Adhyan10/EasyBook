import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { getGateway } from '../../src/gateway/index.js';
import { sign } from '../../src/gateway/signature.js';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { expireStaleHolds } from '../../src/services/holdExpiry.js';
import { clearDb, closeTestDb, connectTestDb } from '../helpers/db.js';
import { authHeader, createRestaurant, createTable, createUser } from '../helpers/factories.js';

const app = createApp();
const SECRET = 'test-mock-secret';
const DATE = '2099-06-15';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(clearDb);

async function setup() {
  const owner = await createUser('owner');
  const restaurant = await createRestaurant(owner);
  await createTable(restaurant, { seats: 4 });
  const diner = await createUser('diner');
  return { restaurant, diner };
}

async function hold(diner, restaurant) {
  const res = await request(app)
    .post('/api/bookings')
    .set(authHeader(diner))
    .send({ restaurantId: String(restaurant._id), date: DATE, slotStart: '19:00', partySize: 2 });
  expect(res.status).toBe(201);
  return { bookingId: res.body.data.booking._id, orderId: res.body.data.order.orderId };
}

const verify = (diner, body) => request(app).post('/api/payments/verify').set(authHeader(diner)).send(body);
const webhookBody = (orderId, paymentId, amount = 5000) =>
  JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId, amount } } } });
const sendWebhook = (body, signature = sign(SECRET, body)) =>
  request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .send(body);

describe('POST /api/payments/verify', () => {
  it('confirms the booking and marks the payment paid', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const res = await verify(diner, getGateway().simulatePayment(orderId));
    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('confirmed');
    expect((await Booking.findById(bookingId)).status).toBe('confirmed');
    const payment = await Payment.findOne({ booking: bookingId });
    expect(payment).toMatchObject({ status: 'paid', gatewayPaymentId: `pay_mock_${orderId}` });
  });

  it('rejects a bad signature and leaves the booking pending', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const paid = getGateway().simulatePayment(orderId);
    const res = await verify(diner, { ...paid, signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await Booking.findById(bookingId)).status).toBe('pending_payment');
  });

  it('is idempotent when called twice', async () => {
    const { restaurant, diner } = await setup();
    const { orderId } = await hold(diner, restaurant);
    const paid = getGateway().simulatePayment(orderId);
    expect((await verify(diner, paid)).status).toBe(200);
    const second = await verify(diner, paid);
    expect(second.status).toBe(200);
    expect(second.body.data.outcome).toBe('already_processed');
    expect(await Payment.countDocuments({ status: 'paid' })).toBe(1);
  });

  it("forbids verifying someone else's order and 404s on unknown orders", async () => {
    const { restaurant, diner } = await setup();
    const stranger = await createUser('diner');
    const { orderId } = await hold(diner, restaurant);
    expect((await verify(stranger, getGateway().simulatePayment(orderId))).status).toBe(403);
    expect((await verify(diner, getGateway().simulatePayment('order_unknown'))).status).toBe(404);
  });

  it('rejects missing fields with 400', async () => {
    const { diner } = await setup();
    expect((await verify(diner, { orderId: 'x' })).status).toBe(400);
  });
});

describe('POST /api/payments/webhook', () => {
  it('confirms a booking from a signed payment.captured event', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const res = await sendWebhook(webhookBody(orderId, 'pay_hook_1'));
    expect(res.status).toBe(200);
    expect((await Booking.findById(bookingId)).status).toBe('confirmed');
  });

  it('rejects an invalid signature', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const res = await sendWebhook(webhookBody(orderId, 'pay_hook_1'), 'bad-signature');
    expect(res.status).toBe(400);
    expect((await Booking.findById(bookingId)).status).toBe('pending_payment');
  });

  it('rejects an amount that does not match the deposit', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const res = await sendWebhook(webhookBody(orderId, 'pay_hook_1', 100));
    expect(res.status).toBe(400);
    expect((await Booking.findById(bookingId)).status).toBe('pending_payment');
  });

  it('acknowledges but ignores other events', async () => {
    const body = JSON.stringify({ event: 'order.paid' });
    const res = await sendWebhook(body);
    expect(res.status).toBe(200);
    expect(res.body.data.ignored).toBe(true);
  });

  it('confirms once when verify and webhook race', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    const paid = getGateway().simulatePayment(orderId);
    const [a, b] = await Promise.all([verify(diner, paid), sendWebhook(webhookBody(orderId, paid.paymentId))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await Booking.findById(bookingId)).status).toBe('confirmed');
    expect((await Payment.findOne({ booking: bookingId })).status).toBe('paid');
  });
});

describe('late payments', () => {
  async function expireHold(bookingId) {
    await Booking.updateOne({ _id: bookingId }, { holdExpiresAt: new Date('2000-01-01') });
    await expireStaleHolds();
    expect((await Booking.findById(bookingId)).status).toBe('expired');
  }

  it('confirms a late payment when the slot is still free', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    await expireHold(bookingId);
    const res = await verify(diner, getGateway().simulatePayment(orderId));
    expect(res.status).toBe(200);
    expect((await Booking.findById(bookingId)).status).toBe('confirmed');
  });

  it('refunds automatically when the slot was rebooked meanwhile', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    await expireHold(bookingId);
    const other = await createUser('diner');
    const rebook = await request(app)
      .post('/api/bookings')
      .set(authHeader(other))
      .send({ restaurantId: String(restaurant._id), date: DATE, slotStart: '19:00', partySize: 2 });
    expect(rebook.status).toBe(201);

    const res = await verify(diner, getGateway().simulatePayment(orderId));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/refunded/i);
    expect((await Payment.findOne({ booking: bookingId })).status).toBe('refunded');
    expect((await Booking.findById(rebook.body.data.booking._id)).status).toBe('pending_payment');
    expect((await Booking.findById(bookingId)).status).toBe('expired');
  });
});

describe('verify after the webhook already refunded', () => {
  it('tells the diner they were refunded instead of confirming', async () => {
    const { restaurant, diner } = await setup();
    const { bookingId, orderId } = await hold(diner, restaurant);
    await Booking.updateOne({ _id: bookingId }, { holdExpiresAt: new Date('2000-01-01') });
    await expireStaleHolds();
    const other = await createUser('diner');
    await request(app)
      .post('/api/bookings')
      .set(authHeader(other))
      .send({ restaurantId: String(restaurant._id), date: DATE, slotStart: '19:00', partySize: 2 });

    const paid = getGateway().simulatePayment(orderId);
    const hookRes = await sendWebhook(webhookBody(orderId, paid.paymentId));
    expect(hookRes.body.data.outcome).toBe('refunded');

    const res = await verify(diner, paid);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/refunded/i);
  });
});

describe('POST /api/payments/mock-pay', () => {
  it("returns a signature that verifies, only for the booking's diner", async () => {
    const { restaurant, diner } = await setup();
    const stranger = await createUser('diner');
    const { bookingId } = await hold(diner, restaurant);

    const denied = await request(app).post('/api/payments/mock-pay').set(authHeader(stranger)).send({ bookingId });
    expect(denied.status).toBe(404);

    const ok = await request(app).post('/api/payments/mock-pay').set(authHeader(diner)).send({ bookingId });
    expect(ok.status).toBe(200);
    expect((await verify(diner, ok.body.data)).status).toBe(200);
  });
});
