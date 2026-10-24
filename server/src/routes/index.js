import { Router } from 'express';
import { sendOk } from '../utils/respond.js';
import { authRoutes } from './authRoutes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => sendOk(res, { status: 'ok' }));
apiRouter.use('/auth', authRoutes);
