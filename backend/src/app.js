import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createLimiters } from './middleware/rateLimiters.js';
import { apiRouter } from './routes/index.js';

export function createApp({ rateLimit = env.NODE_ENV === 'test' ? null : {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render's proxy, so client IPs are real
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));
  if (rateLimit) {
    const limiters = createLimiters(rateLimit);
    app.use('/api', limiters.global);
    app.use('/api/auth', limiters.auth);
  }
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
