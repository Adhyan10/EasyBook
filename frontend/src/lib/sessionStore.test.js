import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSessionStore } from './sessionStore.js';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const brokenStorage = () => ({
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
});
const session = { token: 't-1', user: { id: 'u1', name: 'Asha', role: 'diner' } };

describe('createSessionStore', () => {
  it('saves and restores a session, including the user', () => {
    const store = createSessionStore(memoryStorage());
    store.write(session);
    assert.deepEqual(store.read(), session);
  });

  it('forgets the session when written as null', () => {
    const store = createSessionStore(memoryStorage());
    store.write(session);
    store.write(null);
    assert.equal(store.read(), null);
  });

  it('keeps tabs independent: each tab has its own storage and its own account', () => {
    const tabA = createSessionStore(memoryStorage());
    const tabB = createSessionStore(memoryStorage());
    tabA.write({ token: 'owner-token', user: { role: 'owner' } });
    tabB.write({ token: 'diner-token', user: { role: 'diner' } });
    assert.equal(tabA.read().user.role, 'owner');
    assert.equal(tabB.read().user.role, 'diner');
    tabB.write(null);
    assert.equal(tabA.read().token, 'owner-token');
  });

  it('reads null for empty, corrupt or token-less data', () => {
    const storage = memoryStorage();
    const store = createSessionStore(storage, 'k');
    assert.equal(store.read(), null);
    storage.setItem('k', '{not json');
    assert.equal(store.read(), null);
    storage.setItem('k', JSON.stringify({ user: { name: 'x' } }));
    assert.equal(store.read(), null);
  });

  it('never throws when storage is blocked', () => {
    const store = createSessionStore(brokenStorage());
    assert.equal(store.read(), null);
    assert.doesNotThrow(() => store.write(session));
    assert.doesNotThrow(() => store.write(null));
  });

  it('removes the old shared login token so tabs stop sharing an account', () => {
    const legacy = memoryStorage();
    legacy.setItem('easybook.token', 'old-shared-token');
    const store = createSessionStore(memoryStorage(), 'easybook.session', legacy);
    store.clearLegacy();
    assert.equal(legacy.getItem('easybook.token'), null);
    assert.doesNotThrow(() => createSessionStore(memoryStorage(), 'k', brokenStorage()).clearLegacy());
  });
});
