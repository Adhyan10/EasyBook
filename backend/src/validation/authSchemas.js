import { z } from 'zod';
import { ROLES } from '../constants.js';

const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores bytes beyond 72

const email = z.string().trim().email().transform((value) => value.toLowerCase());

export const registerBody = z.object({
  name: z.string().trim().min(2).max(60),
  email,
  password: z.string().min(8).max(MAX_PASSWORD_LENGTH),
  role: z.enum(Object.values(ROLES)),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
