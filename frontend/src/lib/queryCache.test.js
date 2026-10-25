import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createQueryCache } from './queryCache.js';

const clock = (start = 1_000) => {
  let now = start;
  return { now: () => now, advance: (ms) => { now += ms; } };
};

describe('createQueryCache', () => {
  it('returns stored data and reports it as fresh, then stale, then gone', () => {
    const time = clock();
    const cache = createQueryCache({ now: time.now, freshMs: 1000, maxAgeMs: 5000 });
    assert.equal(cache.peek('a'), null);
    cache.set('a', { n: 1 });
    assert.deepEqual(cache.peek('a').data, { n: 1 });
    assert.equal(cache.isFresh('a'), true);
    time.advance(1500);
    assert.equal(cache.isFresh('a'), false);
    assert.deepEqual(cache.peek('a').data, { n: 1 });
    time.advance(4000);
    assert.equal(cache.peek('a'), null);
  });

  it('shares one in-flight request between callers of the same key', async () => {
    const cache = createQueryCache();
    let calls = 0;
    const loader = async () => { calls += 1; return { ok: true }; };
    const [a, b] = await Promise.all([cache.fetch('k', loader), cache.fetch('k', loader)]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
  });

  it('stores fetched data and lets a forced fetch go to the network again', async () => {
    const cache = createQueryCache();
    let calls = 0;
    const loader = async () => { calls += 1; return { calls }; };
    await cache.fetch('k', loader);
    assert.equal(cache.peek('k').data.calls, 1);
    await cache.fetch('k', loader, { force: true });
    assert.equal(cache.peek('k').data.calls, 2);
  });

  it('does not cache failures and allows a retry', async () => {
    const cache = createQueryCache();
    await assert.rejects(() => cache.fetch('k', async () => { throw new Error('down'); }), /down/);
    assert.equal(cache.peek('k'), null);
    assert.deepEqual(await cache.fetch('k', async () => ({ fine: true })), { fine: true });
  });

  it('clears everything, or only keys with a prefix', () => {
    const cache = createQueryCache();
    cache.set('/restaurants/1', 1);
    cache.set('/restaurants/1/menu', 2);
    cache.set('/other', 3);
    cache.clear('/restaurants/1');
    assert.equal(cache.peek('/restaurants/1'), null);
    assert.equal(cache.peek('/restaurants/1/menu'), null);
    assert.ok(cache.peek('/other'));
    cache.clear();
    assert.equal(cache.peek('/other'), null);
  });
});
