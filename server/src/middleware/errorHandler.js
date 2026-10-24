import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;
const MONGO_DUPLICATE_KEY = 11000;

export function notFoundHandler(_req, _res, next) {
  next(new AppError(HTTP_NOT_FOUND, 'Route not found'));
}

function describe(err) {
  if (err instanceof AppError) return { status: err.status, message: err.message };
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    return { status: HTTP_BAD_REQUEST, message };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: HTTP_BAD_REQUEST, message: `Invalid ${err.path}` };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((e) => e.message).join('; ');
    return { status: HTTP_BAD_REQUEST, message };
  }
  if (err?.code === MONGO_DUPLICATE_KEY) return { status: HTTP_CONFLICT, message: 'Duplicate value' };
  if (err?.type === 'entity.parse.failed') return { status: HTTP_BAD_REQUEST, message: 'Malformed JSON body' };
  return { status: HTTP_SERVER_ERROR, message: 'Something went wrong' };
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const { status, message } = describe(err);
  if (status >= HTTP_SERVER_ERROR) logger.error('Unhandled error', { path: req.path, err });
  return res.status(status).json({ success: false, data: null, error: message });
}
