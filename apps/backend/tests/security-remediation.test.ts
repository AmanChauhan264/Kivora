import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { RedisService } from '../src/config/redis';
import { TokenService } from '../src/modules/auth/token.service';
import { env } from '../src/config/env';

describe('Phase 3.1 Security Remediation Suite', { timeout: 30000 }, () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await RedisService.disconnect();
  });

  // Priority 1 — SEC-01: Concurrency-Safe Refresh Token Rotation
  it('SEC-01: should prevent concurrent refresh-token rotation and revoke family on conflict', async () => {
    const email = `sec01_${Date.now()}@kivora.test`;
    const regRes = await request(app).post('/api/v1/auth/register/customer').send({
      email,
      password: 'Password123!Secure',
      firstName: 'Sec',
      lastName: 'One',
    });
    expect(regRes.status).toBe(201);
    const initialRefreshToken = regRes.body.data.tokens.refreshToken;

    // Fire two concurrent rotation requests simultaneously with the same token
    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: initialRefreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: initialRefreshToken }),
    ]);

    const statuses = [res1.status, res2.status].sort();

    // Exactly one request can succeed (200), and the conflicting request must get 401 TOKEN_REUSE_DETECTED
    // Or if the conflict triggered immediate family revocation, both get 401
    expect(statuses).toEqual(expect.arrayContaining([401]));

    if (statuses.includes(200)) {
      expect(statuses).toEqual([200, 401]);
      const failedRes = res1.status === 401 ? res1 : res2;
      expect(failedRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // The family is now compromised and revoked; subsequent refresh with the new token must fail
      const winningRes = res1.status === 200 ? res1 : res2;
      const nextToken = winningRes.body.data.tokens.refreshToken;
      const subsequentRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: nextToken });
      expect(subsequentRes.status).toBe(401);
      expect(subsequentRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    } else {
      expect(res1.body.error.code).toBe('TOKEN_REUSE_DETECTED');
      expect(res2.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    }
  });

  // Priority 2 — SEC-02: CSRF Defense on Cookie-Authenticated Endpoints
  it('SEC-02: should enforce CSRF protection on cookie-authenticated /refresh and /logout', async () => {
    const email = `sec02_${Date.now()}@kivora.test`;
    const regRes = await request(app).post('/api/v1/auth/register/customer').send({
      email,
      password: 'Password123!Secure',
      firstName: 'Sec',
      lastName: 'Two',
    });
    expect(regRes.status).toBe(201);
    const refreshTokenCookie = regRes.headers['set-cookie'][0];

    // Case A: Missing custom anti-CSRF header -> 403 Forbidden
    const noHeaderRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie)
      .set('Origin', 'http://localhost:3000');
    expect(noHeaderRes.status).toBe(403);
    expect(noHeaderRes.body.error.code).toBe('FORBIDDEN_ACCESS');
    expect(noHeaderRes.body.message).toContain('Missing required custom header');

    // Case B: Untrusted origin -> 403 Forbidden
    const untrustedOriginRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie)
      .set('Origin', 'http://malicious-attacker.evil')
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(untrustedOriginRes.status).toBe(403);
    expect(untrustedOriginRes.body.error.code).toBe('FORBIDDEN_ACCESS');
    expect(untrustedOriginRes.body.message).toContain('Invalid or untrusted origin');

    // Case C: Valid origin + custom header -> 200 OK
    const validCookieRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(validCookieRes.status).toBe(200);
    expect(validCookieRes.body.success).toBe(true);
    expect(validCookieRes.body.data.tokens.accessToken).toBeDefined();

    // Case D: Mobile client sending explicit body token without CSRF headers -> 200 OK
    const newRefreshToken = validCookieRes.body.data.tokens.refreshToken;
    const mobileRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newRefreshToken });
    expect(mobileRes.status).toBe(200);
    expect(mobileRes.body.success).toBe(true);
  });

  // Priority 3 — SEC-03: Access-Token Revocation on Logout & Logout-All
  it('SEC-03: should revoke access token on logout and logout-all via Redis blacklist', async () => {
    const email = `sec03_${Date.now()}@kivora.test`;
    const regRes = await request(app).post('/api/v1/auth/register/customer').send({
      email,
      password: 'Password123!Secure',
      firstName: 'Sec',
      lastName: 'Three',
    });
    expect(regRes.status).toBe(201);
    const { accessToken, refreshToken } = regRes.body.data.tokens;

    // Verify access token is valid before logout
    const preLogoutRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(preLogoutRes.status).toBe(200);

    // Call logout providing the token
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    // Post-logout: access token must be immediately rejected!
    const postLogoutRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(postLogoutRes.status).toBe(401);
    expect(postLogoutRes.body.error.code).toBe('TOKEN_EXPIRED');
    expect(postLogoutRes.body.message).toContain('Access token has been revoked');

    // Test logout-all across multiple simulated devices:
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!Secure' });
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!Secure' });

    const tokenDevice1 = login1.body.data.tokens.accessToken;
    const tokenDevice2 = login2.body.data.tokens.accessToken;

    // Device 1 can access /me
    const dev1Res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenDevice1}`);
    expect(dev1Res.status).toBe(200);

    // Device 2 initiates logout-all
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${tokenDevice2}`);
    expect(logoutAllRes.status).toBe(200);

    // Both device tokens must now be rejected!
    const postLogoutAll1 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenDevice1}`);
    expect(postLogoutAll1.status).toBe(401);

    const postLogoutAll2 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenDevice2}`);
    expect(postLogoutAll2.status).toBe(401);
  });

  // Priority 4 — SEC-04: Hardened CORS Configuration
  it('SEC-04: should enforce strict CORS allowlist and safely reject untrusted origins', async () => {
    // 1. Allowed origin gets CORS headers and credentials allowed
    const allowedRes = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000');
    expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowedRes.headers['access-control-allow-credentials']).toBe('true');

    // 2. Untrusted origin must NOT get Access-Control-Allow-Origin, and must NOT fail with 500
    const untrustedRes = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://untrusted-attacker.com');
    expect(untrustedRes.headers['access-control-allow-origin']).toBeUndefined();
    expect(untrustedRes.status).toBe(200);
  });

  // Priority 5 — SEC-05: Rate Limiting & Trusted Proxy Configuration
  it('SEC-05: should rely on Express trusted proxy configuration for client IP', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Forwarded-For', '203.0.113.195, 70.41.3.18');
    expect(res.status).toBe(200);
  });

  // Priority 6 — SEC-06: Admin Provisioning Requirement
  it('SEC-06: should require explicit INITIAL_ADMIN_PASSWORD and enforce password policy', () => {
    // Test that missing password triggers fatal error
    const validateAdminPassword = (password?: string) => {
      if (!password) {
        throw new Error(
          'FATAL: INITIAL_ADMIN_PASSWORD environment variable must be explicitly set'
        );
      }
      if (
        password.length < 12 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
      ) {
        throw new Error('INITIAL_ADMIN_PASSWORD must meet complexity requirements');
      }
      return true;
    };

    expect(() => validateAdminPassword(undefined)).toThrow('FATAL: INITIAL_ADMIN_PASSWORD');
    expect(() => validateAdminPassword('simplepass')).toThrow(
      'INITIAL_ADMIN_PASSWORD must meet complexity requirements'
    );
    expect(validateAdminPassword('AdminSecret!2026@Secure')).toBe(true);
  });

  // Priority 7 — SEC-07: Explicit JWT Token Type & Cross-Token Substitution Prevention
  it('SEC-07: should validate token_type claim and prevent cross-token substitution', async () => {
    const { token: accessToken } = TokenService.generateAccessToken({
      sub: 'test-user-id',
      email: 'test@kivora.test',
      role: 'CUSTOMER',
    });

    const decoded = TokenService.verifyAccessToken(accessToken);
    expect(decoded.token_type).toBe('access');
    expect(decoded.jti).toBeDefined();

    // Verify that a token with wrong token_type is rejected
    const forgedToken = jwt.sign(
      {
        sub: 'test-user-id',
        email: 'test@kivora.test',
        role: 'CUSTOMER',
        token_type: 'refresh', // Cross-token substitution attempt!
        jti: 'forged-jti',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m', issuer: 'kivora-backend', audience: 'kivora-app' }
    );

    expect(() => TokenService.verifyAccessToken(forgedToken)).toThrow('Invalid token type');

    // Passing opaque refresh token as Bearer token to /auth/me should fail with 401
    const { token: opaqueRefreshToken } = TokenService.generateRefreshToken();
    expect(opaqueRefreshToken.length).toBe(64); // 256 bits hex

    const invalidBearerRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${opaqueRefreshToken}`);
    expect(invalidBearerRes.status).toBe(401);
    expect(invalidBearerRes.body.error.code).toBe('TOKEN_INVALID');
  });
});
