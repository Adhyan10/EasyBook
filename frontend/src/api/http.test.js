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
