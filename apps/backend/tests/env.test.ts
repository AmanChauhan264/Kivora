import { describe, it, expect } from 'vitest';
import { env } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  it('should load and validate default environment settings', () => {
    expect(env).toBeDefined();
    expect(env.PORT).toBeGreaterThan(0);
    expect(['development', 'production', 'test']).toContain(env.NODE_ENV);
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.REDIS_URL).toBeDefined();
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(env.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it('should parse CORS origins properly', () => {
    const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
    expect(origins.length).toBeGreaterThan(0);
  });
});
