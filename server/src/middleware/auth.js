import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';

const INVALID_TOKEN = 'Invalid or expired token';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, INVALID_TOKEN);
  }

  const user = await User.findById(payload.sub).select('-passwordHash');
  if (!user) throw new AppError(401, INVALID_TOKEN);
  req.user = user;
  next();
});

export const requireRole = (role) => (req, _res, next) =>
  req.user?.role === role ? next() : next(new AppError(403, `${role} access only`));
