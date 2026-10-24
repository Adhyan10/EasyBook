import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const DEFAULT_GLOBAL_MAX = 300;
const DEFAULT_AUTH_MAX = 20;

const build = (limit, windowMs) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ success: false, data: null, error: 'Too many requests. Please try again later.' }),
  });

export function createLimiters({
  windowMs = FIFTEEN_MINUTES_MS,
  globalMax = DEFAULT_GLOBAL_MAX,
  authMax = DEFAULT_AUTH_MAX,
} = {}) {
  return { global: build(globalMax, windowMs), auth: build(authMax, windowMs) };
}
