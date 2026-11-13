import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Check Endpoint (/api/v1/health)', () => {
  const app = createApp();

  it('should return a standardized health check response', async () => {
    const res = await request(app).get('/api/v1/health');

    // Health returns 200 (healthy/degraded) or 503 (unhealthy)
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('service', 'kivora-backend');
    expect(res.body.data).toHaveProperty('components');
    expect(res.body.data.components).toHaveProperty('database');
    expect(res.body.data.components).toHaveProperty('redis');
  });

  it('should attach and return an x-request-id header', async () => {
    const customId = 'test-request-id-12345';
    const res = await request(app).get('/api/v1/health').set('x-request-id', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});
