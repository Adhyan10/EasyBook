import 'dotenv/config';

const read = (name, fallback = '') => process.env[name] ?? fallback;
const isProduction = read('NODE_ENV') === 'production';

function requireValue(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const gateway = read('GATEWAY', 'mock');

export const env = Object.freeze({
  NODE_ENV: read('NODE_ENV', 'development'),
  PORT: Number(read('PORT', '5000')),
  MONGO_URI: read('MONGO_URI', 'mongodb://127.0.0.1:27017/easybook'),
  JWT_SECRET: isProduction ? requireValue('JWT_SECRET', read('JWT_SECRET')) : read('JWT_SECRET', 'dev-only-secret'),
  JWT_EXPIRES_IN: read('JWT_EXPIRES_IN', '7d'),
  CLIENT_ORIGIN: read('CLIENT_ORIGIN', 'http://localhost:5173'),
  GATEWAY: gateway,
  MOCK_GATEWAY_SECRET: read('MOCK_GATEWAY_SECRET', 'mock-gateway-secret'),
  RAZORPAY_KEY_ID: gateway === 'razorpay' ? requireValue('RAZORPAY_KEY_ID', read('RAZORPAY_KEY_ID')) : '',
  RAZORPAY_KEY_SECRET: gateway === 'razorpay' ? requireValue('RAZORPAY_KEY_SECRET', read('RAZORPAY_KEY_SECRET')) : '',
  RAZORPAY_WEBHOOK_SECRET:
    gateway === 'razorpay' ? requireValue('RAZORPAY_WEBHOOK_SECRET', read('RAZORPAY_WEBHOOK_SECRET')) : '',
});
