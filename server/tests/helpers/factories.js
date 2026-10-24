import bcrypt from 'bcryptjs';
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
