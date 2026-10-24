import { Router } from 'express';
import { sendOk } from '../utils/respond.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => sendOk(res, { status: 'ok' }));
