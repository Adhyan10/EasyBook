import { afterEach, describe, expect, it } from 'vitest';
import { getGateway, resetGateway, setGateway } from '../../src/gateway/index.js';
import { createMockGateway } from '../../src/gateway/mockGateway.js';
import { safeEqual, sign } from '../../src/gateway/signature.js';

describe('signature helpers', () => {
  it('signs deterministically and compares safely', () => {
    expect(sign('s', 'data')).toBe(sign('s', 'data'));
    expect(sign('s', 'data')).not.toBe(sign('other', 'data'));
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('mock gateway', () => {
  const gateway = createMockGateway({ secret: 'k' });

  it('creates unique orders in paise', async () => {
    const a = await gateway.createOrder({ amountPaise: 5000, receipt: 'r1' });
    const b = await gateway.createOrder({ amountPaise: 5000, receipt: 'r2' });
    expect(a).toMatchObject({ amount: 5000, currency: 'INR' });
    expect(a.orderId).not.toBe(b.orderId);
  });

  it('verifies a simulated payment and rejects tampering', async () => {
    const { orderId } = await gateway.createOrder({ amountPaise: 5000, receipt: 'r' });
    const paid = gateway.simulatePayment(orderId);
    expect(gateway.verifyPaymentSignature(paid)).toBe(true);
    expect(gateway.verifyPaymentSignature({ ...paid, paymentId: 'pay_other' })).toBe(false);
    expect(gateway.verifyPaymentSignature({ ...paid, signature: undefined })).toBe(false);
  });

  it('verifies webhook signatures over the raw body', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    expect(gateway.verifyWebhookSignature(body, sign('k', body))).toBe(true);
    expect(gateway.verifyWebhookSignature(body, 'bad')).toBe(false);
    expect(gateway.verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('refunds', async () => {
    expect(await gateway.refund({ paymentId: 'pay_1', amountPaise: 5000 })).toEqual({ refundId: 'rfnd_mock_pay_1' });
  });
});

describe('gateway registry', () => {
  afterEach(resetGateway);

  it('defaults to the mock gateway in tests and can be swapped', () => {
    expect(getGateway().name).toBe('mock');
    const fake = { name: 'fake' };
    setGateway(fake);
    expect(getGateway()).toBe(fake);
  });
});
