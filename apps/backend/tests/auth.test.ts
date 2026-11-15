import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { RedisService } from '../src/config/redis';

describe('Authentication Engine (/api/v1/auth)', { timeout: 30000 }, () => {
  const app = createApp();
  const testTimestamp = Date.now();

  const customerData = {
    email: `customer_${testTimestamp}@kivora.test`,
    password: 'Password123!Secure',
    firstName: 'Alice',
    lastName: 'Sharma',
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
  };

  const sellerPan = `ABCDE${Math.floor(1000 + Math.random() * 8999)}F`;
  const sellerData = {
    email: `seller_${testTimestamp}@kivora.test`,
    password: 'SellerPass123!Secure',
    firstName: 'Bob',
    lastName: 'Merchant',
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    storeName: `Bob Retail ${testTimestamp}`,
    panNumber: sellerPan,
    gstin: `29${sellerPan}1Z5`,
  };

  let customerAccessToken = '';
  let customerRefreshToken = '';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await RedisService.disconnect();
  });

  // 1. Password Hashing Verification
  it('should hash passwords using Argon2id with recommended parameters', async () => {
    const rawPassword = 'SecurePassword2026!';
    const hash = await argon2.hash(rawPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    expect(hash).toContain('$argon2id$');
    const isVerified = await argon2.verify(hash, rawPassword);
    expect(isVerified).toBe(true);

    const isWrongPassword = await argon2.verify(hash, 'WrongPassword!');
    expect(isWrongPassword).toBe(false);
  });

  // 2. Customer Registration
  it('should register a customer and create User + CustomerProfile transactionally', async () => {
    const res = await request(app).post('/api/v1/auth/register/customer').send(customerData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(customerData.email.toLowerCase());
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.customerProfile.firstName).toBe('Alice');
    expect(res.body.data.user.customerProfile.lastName).toBe('Sharma');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');

    // Check HttpOnly cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('kivora_refresh_token=');
    expect(cookies[0]).toContain('HttpOnly');

    customerAccessToken = res.body.data.tokens.accessToken;
    customerRefreshToken = res.body.data.tokens.refreshToken;

    // Verify database record
    const userInDb = await prisma.user.findUnique({
      where: { email: customerData.email.toLowerCase() },
      include: { customerProfile: true },
    });
    expect(userInDb).toBeDefined();
    expect(userInDb?.customerProfile?.firstName).toBe('Alice');
  });

  // 3. Duplicate Email Registration Rejection
  it('should reject registration with a duplicate email address (409 Conflict)', async () => {
    const res = await request(app).post('/api/v1/auth/register/customer').send(customerData);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT_ERROR');
  });

  // 4. Input Validation (Password strength)
  it('should reject registration if password does not meet complexity requirements', async () => {
    const weakUser = {
      email: `weak_${Date.now()}@kivora.test`,
      password: 'weak', // too short, no uppercase, no number
      firstName: 'Weak',
      lastName: 'User',
    };

    const res = await request(app).post('/api/v1/auth/register/customer').send(weakUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 5. Seller Registration
  it('should register a seller with SellerProfile and Store (KYC PENDING)', async () => {
    const res = await request(app).post('/api/v1/auth/register/seller').send(sellerData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('SELLER');
    expect(res.body.data.user.sellerProfile.panNumber).toBe(sellerData.panNumber);
    expect(res.body.data.user.sellerProfile.kycVerified).toBe(false);
    expect(res.body.data.user.sellerProfile.store.status).toBe('PENDING');

    // Verify in database
    const sellerInDb = await prisma.user.findUnique({
      where: { email: sellerData.email.toLowerCase() },
      include: { sellerProfile: { include: { store: true } } },
    });
    expect(sellerInDb?.sellerProfile?.store?.name).toBe(sellerData.storeName);
    expect(sellerInDb?.sellerProfile?.kycVerified).toBe(false);
  });

  // 6. Login Success
  it('should authenticate valid credentials and issue tokens', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: customerData.email,
      password: customerData.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(customerData.email.toLowerCase());
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  // 7. Login Failure (Wrong password)
  it('should reject login with wrong password using generic error (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: customerData.email,
      password: 'IncorrectPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 8. Login Failure (Non-existent email)
  it('should reject login with non-existent email using generic error (401)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent_user_999@kivora.test',
      password: 'SomePassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Invalid email or password');
  });

  // 9. Current User Profile (/auth/me)
  it('should return authenticated user profile via Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(customerData.email.toLowerCase());
    expect(res.body.data.user.customerProfile.firstName).toBe('Alice');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  // 10. Refresh Token Rotation
  it('should rotate refresh token and issue new token pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: customerRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).not.toBe(customerRefreshToken);

    const rotatedRefreshToken = res.body.data.tokens.refreshToken;

    // 11. Refresh Token Reuse Detection
    // Attempting to reuse the OLD (already rotated) customerRefreshToken
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: customerRefreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.success).toBe(false);
    expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

    // Confirm that the entire family was revoked: even the new token should now be invalid!
    const familyCheckRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken });

    expect(familyCheckRes.status).toBe(401);
    expect(familyCheckRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  // 12. Logout
  it('should revoke refresh token on logout', async () => {
    // Log in fresh to obtain active session
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: customerData.email,
      password: customerData.password,
    });

    const activeRefreshToken = loginRes.body.data.tokens.refreshToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: activeRefreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.loggedOut).toBe(true);

    // Refresh with the logged out token must fail
    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: activeRefreshToken });

    expect(refreshAfterLogout.status).toBe(401);
  });

  // 13. Logout All
  it('should revoke all active sessions for user on logout-all', async () => {
    // Log in twice to simulate two devices
    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerData.email, password: customerData.password });

    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerData.email, password: customerData.password });

    const token1 = login1.body.data.tokens.refreshToken;
    const token2 = login2.body.data.tokens.refreshToken;
    const accessToken = login2.body.data.tokens.accessToken;

    // Call logout-all
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutAllRes.status).toBe(200);
    expect(logoutAllRes.body.data.loggedOutAll).toBe(true);

    // Both sessions must now be revoked
    const refresh1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token1 });
    expect(refresh1.status).toBe(401);

    const refresh2 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token2 });
    expect(refresh2.status).toBe(401);
  });
});
