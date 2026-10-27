import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ApiError, request } from './http.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const okResponse = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

describe('request', () => {
  it('returns the data field of a successful response', async () => {
    globalThis.fetch = async () => okResponse({ hello: 'world' });
    assert.deepEqual(await request('/x'), { hello: 'world' });
  });

  it('gives up with a clear error when the server never answers', async () => {
    globalThis.fetch = (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    await assert.rejects(
      () => request('/slow', { timeoutMs: 30 }),
      (err) => err instanceof ApiError && err.status === 0 && /taking too long/i.test(err.message),
    );
  });

  it('reports an unreachable server as a network error', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(() => request('/x'), (err) => err instanceof ApiError && err.status === 0 && /cannot reach/i.test(err.message));
  });

  it('surfaces the API error message and status', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ success: false, error: 'Slot just taken' }) });
    await assert.rejects(() => request('/x'), (err) => err.status === 409 && err.message === 'Slot just taken');
  });
});

const jsonError = (status, error) => ({ ok: false, status, json: async () => ({ success: false, error }) });
const proxyMiss = (status) => ({ ok: false, status, json: async () => { throw new SyntaxError('Unexpected token N'); } });
const sequence = (...responses) => {
  const calls = { n: 0 };
  globalThis.fetch = async () => {
    const next = responses[Math.min(calls.n, responses.length - 1)];
    calls.n += 1;
    if (next instanceof Error) throw next;
    return next;
  };
  return calls;
};

describe('request retries for reads', () => {
  it('retries a GET that hit a proxy hiccup (404 without a JSON body) and then succeeds', async () => {
    const calls = sequence(proxyMiss(404), proxyMiss(404), okResponse({ fine: true }));
    assert.deepEqual(await request('/x', { retryDelayMs: 0 }), { fine: true });
    assert.equal(calls.n, 3);
  });

  it('retries a GET on 502, 503 and 504 and on a network blip', async () => {
    for (const first of [proxyMiss(502), proxyMiss(503), proxyMiss(504), new TypeError('fetch failed')]) {
      const calls = sequence(first, okResponse({ ok: 1 }));
      assert.deepEqual(await request('/x', { retryDelayMs: 0 }), { ok: 1 });
      assert.equal(calls.n, 2);
    }
  });

  it('does not retry the app\'s own errors, including a JSON 404', async () => {
    const calls = sequence(jsonError(404, 'Restaurant not found'));
    await assert.rejects(() => request('/x', { retryDelayMs: 0 }), (err) => err.status === 404 && err.message === 'Restaurant not found');
    assert.equal(calls.n, 1);
    const unauthorized = sequence(jsonError(401, 'Authentication required'));
    await assert.rejects(() => request('/x', { retryDelayMs: 0 }), (err) => err.status === 401);
    assert.equal(unauthorized.n, 1);
  });

  it('never retries a write, so a booking or payment cannot be sent twice', async () => {
    const calls = sequence(proxyMiss(503), okResponse({ id: 1 }));
    await assert.rejects(() => request('/bookings', { method: 'POST', body: { a: 1 }, retryDelayMs: 0 }), (err) => err.status === 503);
    assert.equal(calls.n, 1);
  });

  it('gives up after two retries and reports the last failure', async () => {
    const calls = sequence(proxyMiss(404));
    await assert.rejects(() => request('/x', { retryDelayMs: 0 }), (err) => err instanceof ApiError && err.status === 404);
    assert.equal(calls.n, 3);
  });
});
