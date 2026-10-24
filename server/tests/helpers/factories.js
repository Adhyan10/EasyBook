import bcrypt from 'bcryptjs';
import { Restaurant } from '../../src/models/Restaurant.js';
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
