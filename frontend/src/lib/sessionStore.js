// Login state lives in sessionStorage, which is private to one browser tab. localStorage is shared by
// every tab of the site, so logging in as an owner in one tab used to switch all other tabs to the owner.
const DEFAULT_KEY = 'easybook.session';
const LEGACY_KEY = 'easybook.token';

export function createSessionStore(storage, key = DEFAULT_KEY, legacyStorage = null, legacyKey = LEGACY_KEY) {
  return {
    read() {
      try {
        const raw = storage.getItem(key);
        const session = raw ? JSON.parse(raw) : null;
        return session?.token ? session : null;
      } catch {
        return null;
      }
    },
    write(session) {
      try {
        if (session) storage.setItem(key, JSON.stringify(session));
        else storage.removeItem(key);
      } catch {
        // Storage can be blocked (private mode); the session just won't survive a reload.
      }
    },
    clearLegacy() {
      try {
        legacyStorage?.removeItem(legacyKey);
      } catch {
        // Nothing to clean up if storage is blocked.
      }
    },
  };
}

export function browserSessionStore() {
  try {
    return createSessionStore(window.sessionStorage, DEFAULT_KEY, window.localStorage);
  } catch {
    return createSessionStore({ getItem: () => null, setItem() {}, removeItem() {} });
  }
}
