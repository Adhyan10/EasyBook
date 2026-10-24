import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginBody, registerBody } from '../validation/authSchemas.js';

export const authRoutes = Router();

authRoutes.post('/register', validate({ body: registerBody }), register);
authRoutes.post('/login', validate({ body: loginBody }), login);
authRoutes.get('/me', requireAuth, me);
