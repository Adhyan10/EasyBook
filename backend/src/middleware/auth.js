import { AUTH_USER_CACHE_MAX, AUTH_USER_CACHE_TTL_MS } from '../constants.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';

const INVALID_TOKEN = 'Invalid or expired token';

// A signed token proves who the caller is, so re-reading the user from the database on every request
// only adds a network round trip. Keep the user for a short while instead.
const userCache = new Map();
export const clearAuthCache = () => userCache.clear();

async function loadUser(userId) {
  const hit = userCache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.user;
  const user = await User.findById(userId).select('-passwordHash');
  if (user) {
    if (userCache.size >= AUTH_USER_CACHE_MAX) userCache.clear();
    userCache.set(userId, { user, expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS });
  }
  return user;
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, INVALID_TOKEN);
  }

  const user = await loadUser(payload.sub);
  if (!user) throw new AppError(401, INVALID_TOKEN);
  req.user = user;
  next();
});

export const requireRole = (role) => (req, _res, next) =>
  req.user?.role === role ? next() : next(new AppError(403, `${role} access only`));
