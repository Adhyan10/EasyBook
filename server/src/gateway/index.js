import { env } from '../config/env.js';
import { createMockGateway } from './mockGateway.js';
import { createRazorpayGateway } from './razorpayGateway.js';

let instance;

export function getGateway() {
  if (!instance) instance = env.GATEWAY === 'razorpay' ? createRazorpayGateway() : createMockGateway();
  return instance;
}

export const setGateway = (gateway) => {
  instance = gateway;
};

export const resetGateway = () => {
  instance = undefined;
};
