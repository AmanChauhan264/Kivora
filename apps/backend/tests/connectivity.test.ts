import { describe, it, expect } from 'vitest';
import { checkDatabaseHealth } from '../src/config/database';
import { RedisService } from '../src/config/redis';

describe('Database and Redis Connectivity Logic', () => {
  it('should evaluate database health gracefully without throwing unhandled exceptions', async () => {
    const dbHealth = await checkDatabaseHealth();
    expect(dbHealth).toBeDefined();
    expect(typeof dbHealth.isHealthy).toBe('boolean');
    if (dbHealth.isHealthy) {
      expect(typeof dbHealth.latencyMs).toBe('number');
    } else {
      expect(typeof dbHealth.error).toBe('string');
    }
  });

  it('should evaluate Redis health gracefully without throwing unhandled exceptions', async () => {
    const redisHealth = await RedisService.checkHealth();
    expect(redisHealth).toBeDefined();
    expect(typeof redisHealth.isHealthy).toBe('boolean');
    if (redisHealth.isHealthy) {
      expect(typeof redisHealth.latencyMs).toBe('number');
    } else {
      expect(typeof redisHealth.error).toBe('string');
    }
  });
});
