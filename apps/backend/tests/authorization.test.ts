import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';
import { prisma } from '../src/config/database';
import { RedisService } from '../src/config/redis';
import { authenticateAccessToken } from '../src/middleware/authenticate';
import {
  requireRole,
  requireApprovedSeller,
  requireStoreOwnership,
} from '../src/middleware/authorize';
import { createRateLimiter } from '../src/middleware/rate-limiter';
import { errorHandlerMiddleware } from '../src/middleware/error-handler';
import { TokenService } from '../src/modules/auth/token.service';

describe('Authorization & Security Middleware', () => {
  const app = express();
  app.use(express.json());

  // Test endpoints for authorization checks
  app.get('/test/protected', authenticateAccessToken, (req: Request, res: Response) => {
    res.json({ message: 'Access granted', user: req.user });
  });

  app.get(
    '/test/admin-only',
    authenticateAccessToken,
    requireRole('ADMIN'),
    (req: Request, res: Response) => {
      res.json({ message: 'Admin dashboard access' });
    }
  );

  app.get(
    '/test/seller-active-store',
    authenticateAccessToken,
    requireApprovedSeller,
    (req: Request, res: Response) => {
      res.json({ message: 'Active seller store access', storeId: req.user?.storeId });
    }
  );

  app.post(
    '/test/stores/:storeId/products',
    authenticateAccessToken,
    requireStoreOwnership('storeId'),
    (req: Request, res: Response) => {
      res.json({ message: 'Product created for store', storeId: req.params.storeId });
    }
  );

  // Test rate limited endpoint
  const testLimiter = createRateLimiter({
    windowSeconds: 5,
    maxRequests: 3,
    prefix: 'test-limiter',
  });

  app.get('/test/rate-limited', testLimiter, (_req: Request, res: Response) => {
    res.json({ message: 'Within rate limit' });
  });

  app.use(errorHandlerMiddleware);

  let customerToken = '';
  let pendingSellerToken = '';
  let approvedSellerToken = '';
  let adminToken = '';

  let storeAId = '';
  let storeBId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const ts = Date.now();

    // 1. Create Customer User
    const customer = await prisma.user.create({
      data: {
        email: `authz_cust_${ts}@kivora.test`,
        passwordHash: 'dummy',
        role: 'CUSTOMER',
      },
    });
    customerToken = TokenService.generateAccessToken({
      sub: customer.id,
      email: customer.email,
      role: 'CUSTOMER',
    }).token;

    // 2. Create Pending KYC Seller (Store A)
    const pendingSeller = await prisma.user.create({
      data: {
        email: `authz_seller_pending_${ts}@kivora.test`,
        passwordHash: 'dummy',
        role: 'SELLER',
        sellerProfile: {
          create: {
            panNumber: `PANP${ts.toString().slice(-6)}`,
            kycVerified: false, // NOT APPROVED
            store: {
              create: {
                name: `Pending Store ${ts}`,
                slug: `pending-store-${ts}`,
                status: 'PENDING',
              },
            },
          },
        },
      },
      include: { sellerProfile: { include: { store: true } } },
    });
    storeAId = pendingSeller.sellerProfile!.store!.id;
    pendingSellerToken = TokenService.generateAccessToken({
      sub: pendingSeller.id,
      email: pendingSeller.email,
      role: 'SELLER',
      storeId: storeAId,
    }).token;

    // 3. Create Approved KYC Seller (Store B)
    const approvedSeller = await prisma.user.create({
      data: {
        email: `authz_seller_approved_${ts}@kivora.test`,
        passwordHash: 'dummy',
        role: 'SELLER',
        sellerProfile: {
          create: {
            panNumber: `PANA${ts.toString().slice(-6)}`,
            kycVerified: true, // APPROVED
            kycApprovedAt: new Date(),
            store: {
              create: {
                name: `Approved Store ${ts}`,
                slug: `approved-store-${ts}`,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      include: { sellerProfile: { include: { store: true } } },
    });
    storeBId = approvedSeller.sellerProfile!.store!.id;
    approvedSellerToken = TokenService.generateAccessToken({
      sub: approvedSeller.id,
      email: approvedSeller.email,
      role: 'SELLER',
      storeId: storeBId,
    }).token;

    // 4. Create Admin User
    const admin = await prisma.user.create({
      data: {
        email: `authz_admin_${ts}@kivora.test`,
        passwordHash: 'dummy',
        role: 'ADMIN',
      },
    });
    adminToken = TokenService.generateAccessToken({
      sub: admin.id,
      email: admin.email,
      role: 'ADMIN',
    }).token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await RedisService.disconnect();
  });

  // 1. Missing Token
  it('should reject requests without authorization token (401)', async () => {
    const res = await request(app).get('/test/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  // 2. Expired Token
  it('should reject expired access tokens (401 TOKEN_EXPIRED)', async () => {
    // Generate token that expired 10 seconds ago
    const expiredToken = jwt.sign(
      { sub: 'user-123', email: 'test@kivora.test', role: 'CUSTOMER' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-10s', issuer: 'kivora-backend', audience: 'kivora-app' }
    );

    const res = await request(app)
      .get('/test/protected')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // 3. Valid Token Authentication
  it('should allow access with valid access token and populate req.user', async () => {
    const res = await request(app)
      .get('/test/protected')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  // 4. Role Authorization: Admin only
  it('should reject non-admin users from admin-only routes (403 FORBIDDEN_ACCESS)', async () => {
    const custRes = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custRes.status).toBe(403);
    expect(custRes.body.error.code).toBe('FORBIDDEN_ACCESS');

    const sellerRes = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${approvedSellerToken}`);
    expect(sellerRes.status).toBe(403);
    expect(sellerRes.body.error.code).toBe('FORBIDDEN_ACCESS');

    // Admin should succeed
    const adminRes = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.message).toBe('Admin dashboard access');
  });

  // 5. Seller Approval Restrictions (requireApprovedSeller)
  it('should block unapproved/pending sellers and allow approved sellers', async () => {
    // Pending KYC seller -> 403 SELLER_NOT_APPROVED
    const pendingRes = await request(app)
      .get('/test/seller-active-store')
      .set('Authorization', `Bearer ${pendingSellerToken}`);

    expect(pendingRes.status).toBe(403);
    expect(pendingRes.body.error.code).toBe('SELLER_NOT_APPROVED');

    // Approved KYC seller -> 200 OK
    const approvedRes = await request(app)
      .get('/test/seller-active-store')
      .set('Authorization', `Bearer ${approvedSellerToken}`);

    expect(approvedRes.status).toBe(200);
    expect(approvedRes.body.storeId).toBe(storeBId);
  });

  // 6. Store Ownership Restrictions (requireStoreOwnership)
  it('should allow store owner and block other sellers from managing foreign store', async () => {
    // Seller B managing Store B -> 200 OK
    const ownerRes = await request(app)
      .post(`/test/stores/${storeBId}/products`)
      .set('Authorization', `Bearer ${approvedSellerToken}`)
      .send({ title: 'New Product' });

    expect(ownerRes.status).toBe(200);

    // Seller A attempting to manage Store B -> 403 UNAUTHORIZED_STORE_ACCESS
    const foreignRes = await request(app)
      .post(`/test/stores/${storeBId}/products`)
      .set('Authorization', `Bearer ${pendingSellerToken}`)
      .send({ title: 'Hacked Product' });

    expect(foreignRes.status).toBe(403);
    expect(foreignRes.body.error.code).toBe('UNAUTHORIZED_STORE_ACCESS');

    // Admin managing Store B -> 200 OK (Platform admin bypass)
    const adminRes = await request(app)
      .post(`/test/stores/${storeBId}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Product Override' });

    expect(adminRes.status).toBe(200);
  });

  // 7. Rate Limiting Middleware
  it('should enforce rate limits and respond with 429 and Retry-After header', async () => {
    // Make 3 allowed requests
    const res1 = await request(app).get('/test/rate-limited');
    const res2 = await request(app).get('/test/rate-limited');
    const res3 = await request(app).get('/test/rate-limited');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    // 4th request must be rejected
    const res4 = await request(app).get('/test/rate-limited');
    expect(res4.status).toBe(429);
    expect(res4.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res4.headers['retry-after']).toBeDefined();
    expect(res4.headers['ratelimit-remaining']).toBe('0');
  });
});
