import bcrypt from 'bcryptjs';
import { Booking } from '../../src/models/Booking.js';
import { Payment } from '../../src/models/Payment.js';
import { Restaurant } from '../../src/models/Restaurant.js';
import { Table } from '../../src/models/Table.js';
import { User } from '../../src/models/User.js';
import { signToken } from '../../src/utils/jwt.js';

let counter = 0;
export const nextId = () => {
  counter += 1;
  return counter;
};

export async function createUser(role = 'diner', overrides = {}) {
  const n = nextId();
  return User.create({
    name: `${role} ${n}`,
    email: `${role}${n}@example.com`,
    passwordHash: await bcrypt.hash('password123', 4),
    role,
    ...overrides,
  });
}

export const authHeader = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

export function createBookingDoc({ restaurant, table, diner, ...overrides }) {
  return Booking.create({
    restaurant: restaurant._id,
    table: table._id,
    diner: diner._id,
    date: '2099-06-15',
    slotStart: '19:00',
    partySize: 2,
    status: 'confirmed',
    ...overrides,
  });
}

export async function seedConfirmedBooking({
  restaurant,
  table,
  diner,
  partySize = 2,
  bookingStatus = 'confirmed',
  paymentStatus = 'paid',
  ...overrides
}) {
  const booking = await createBookingDoc({ restaurant, table, diner, partySize, status: bookingStatus, ...overrides });
  const n = nextId();
  const payment = await Payment.create({
    booking: booking._id,
    restaurant: restaurant._id,
    amount: restaurant.depositPerPerson * partySize,
    gatewayOrderId: `order_seed_${n}`,
    gatewayPaymentId: `pay_seed_${n}`,
    status: paymentStatus,
  });
  return { booking, payment };
}

export function createTable(restaurant, overrides = {}) {
  return Table.create({ restaurant: restaurant._id, label: `T${nextId()}`, seats: 4, ...overrides });
}

export function createRestaurant(owner, overrides = {}) {
  const n = nextId();
  return Restaurant.create({
    owner: owner._id,
    name: `Place ${n}`,
    cuisine: 'Indian',
    city: 'Pune',
    address: '1 Main Road',
    openTime: '12:00',
    closeTime: '23:00',
    slotMinutes: 60,
    ...overrides,
  });
}
