import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../constants.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';
import { sendOk } from '../utils/respond.js';

const toPublicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.valid.body;
  if (await User.exists({ email })) throw new AppError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role });
  sendOk(res, { user: toPublicUser(user), token: signToken(user) }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email });
  const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!isValid) throw new AppError(401, 'Invalid email or password');
  sendOk(res, { user: toPublicUser(user), token: signToken(user) });
});

export const me = (req, res) => sendOk(res, { user: toPublicUser(req.user) });
