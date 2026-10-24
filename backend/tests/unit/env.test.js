import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEYS = ['NODE_ENV', 'JWT_SECRET', 'GATEWAY', 'ALLOW_MOCK_GATEWAY'];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  vi.resetModules();
});

afterEach(() => {
  KEYS.forEach((key) => {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  });
  vi.resetModules();
});

const loadEnv = () => import('../../src/config/env.js');

describe('production gateway safety', () => {
  it('refuses the mock gateway in production unless explicitly allowed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-secret';
    process.env.GATEWAY = 'mock';
    delete process.env.ALLOW_MOCK_GATEWAY;
    await expect(loadEnv()).rejects.toThrow(/ALLOW_MOCK_GATEWAY/);
  });

  it('accepts the mock gateway in production with the explicit opt-in', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-secret';
    process.env.GATEWAY = 'mock';
    process.env.ALLOW_MOCK_GATEWAY = 'true';
    const { env } = await loadEnv();
    expect(env.GATEWAY).toBe('mock');
  });

  it('does not require the opt-in outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.GATEWAY = 'mock';
    delete process.env.ALLOW_MOCK_GATEWAY;
    const { env } = await loadEnv();
    expect(env.GATEWAY).toBe('mock');
  });
});
