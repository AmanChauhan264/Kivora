import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Error Handling Middleware', () => {
  const app = createApp();

  it('should return a 404 ApiResponse for undefined routes', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-404');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.message).toContain('/api/v1/non-existent-route-404');
  });
});
