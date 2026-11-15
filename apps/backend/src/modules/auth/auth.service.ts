import crypto from 'crypto';
import argon2 from 'argon2';
import type { UserRole, CustomerProfile, SellerProfile, Store } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';
import { ErrorCode } from '../../constants/error-codes';
import { TokenService } from './token.service';
import type { AuthResponseData, AuthTokens, SanitizedUser } from './auth.types';
import type { CustomerRegisterInput, SellerRegisterInput, LoginInput } from './auth.validation';

/**
 * Internal error used to signal a concurrent token consumption race condition
 */
class ConcurrencyReuseDetectedError extends Error {
  constructor(public readonly familyId: string) {
    super('Concurrent refresh token consumption detected');
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthService {
  // Pre-hashed dummy string for timing-attack mitigation when an email does not exist
  private static readonly DUMMY_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$dummySaltForTimingMitigation$dummyHashForKivoraTimingMitigation1234567890';

  /**
   * Registers a customer account with CustomerProfile transactionally
   */
  public static async registerCustomer(
    input: CustomerRegisterInput,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResponseData> {
    const email = input.email.toLowerCase().trim();

    // 1. Check duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError(
        'An account with this email address already exists',
        ErrorCode.CONFLICT_ERROR
      );
    }

    // 2. Check duplicate phone if provided
    if (input.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) {
        throw new ConflictError(
          'An account with this phone number already exists',
          ErrorCode.CONFLICT_ERROR
        );
      }
    }

    // 3. Hash password using Argon2id
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 4. Transactionally create User and CustomerProfile
    const familyId = crypto.randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          phone: input.phone || null,
          role: 'CUSTOMER',
          isActive: true,
          customerProfile: {
            create: {
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
            },
          },
        },
        include: {
          customerProfile: true,
          sellerProfile: { include: { store: true } },
        },
      });

      // Generate tokens
      const { token: accessToken, expiresInSeconds } = TokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        familyId,
      });

      const { token: refreshToken, expiresAt } = TokenService.generateRefreshToken();

      // Persist hashed refresh token
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: TokenService.hashToken(refreshToken),
          familyId,
          expiresAt,
          userAgent: meta?.userAgent || null,
          ipAddress: meta?.ipAddress || null,
        },
      });

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      };

      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    });

    logger.info('Customer registered successfully', { userId: result.user.id });
    return result;
  }

  /**
   * Registers a seller account with SellerProfile and Store transactionally
   */
  public static async registerSeller(
    input: SellerRegisterInput,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResponseData> {
    const email = input.email.toLowerCase().trim();
    const panNumber = input.panNumber.toUpperCase().trim();
    const gstin = input.gstin ? input.gstin.toUpperCase().trim() : null;

    // 1. Check duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError(
        'An account with this email address already exists',
        ErrorCode.CONFLICT_ERROR
      );
    }

    // 2. Check duplicate phone
    if (input.phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) {
        throw new ConflictError(
          'An account with this phone number already exists',
          ErrorCode.CONFLICT_ERROR
        );
      }
    }

    // 3. Check duplicate PAN number
    const existingPan = await prisma.sellerProfile.findUnique({ where: { panNumber } });
    if (existingPan) {
      throw new ConflictError(
        'A seller account with this PAN number already exists',
        ErrorCode.CONFLICT_ERROR
      );
    }

    // 4. Generate unique Store slug from storeName
    const baseSlug = input.storeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let slugSuffix = 1;
    while (await prisma.store.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${slugSuffix}`;
      slugSuffix += 1;
    }

    // 5. Hash password using Argon2id
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 6. Transactionally create User, SellerProfile and Store
    const familyId = crypto.randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          phone: input.phone || null,
          role: 'SELLER',
          isActive: true,
          sellerProfile: {
            create: {
              panNumber,
              gstin,
              kycVerified: false,
              kycSubmittedAt: new Date(),
              store: {
                create: {
                  name: input.storeName.trim(),
                  slug,
                  status: 'PENDING', // Pending KYC verification
                },
              },
            },
          },
        },
        include: {
          customerProfile: true,
          sellerProfile: { include: { store: true } },
        },
      });

      const storeId = user.sellerProfile?.store?.id;

      // Generate tokens
      const { token: accessToken, expiresInSeconds } = TokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        storeId,
        familyId,
      });

      const { token: refreshToken, expiresAt } = TokenService.generateRefreshToken();

      // Persist hashed refresh token
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: TokenService.hashToken(refreshToken),
          familyId,
          expiresAt,
          userAgent: meta?.userAgent || null,
          ipAddress: meta?.ipAddress || null,
        },
      });

      const tokens: AuthTokens = {
        accessToken,
        refreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      };

      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    });

    logger.info('Seller registered successfully (KYC PENDING)', {
      userId: result.user.id,
      storeId: result.user.sellerProfile?.store?.id,
    });
    return result;
  }

  /**
   * Authenticates user via email and password with constant-time verification
   */
  public static async login(
    input: LoginInput,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResponseData> {
    const email = input.email.toLowerCase().trim();

    // 1. Fetch user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customerProfile: true,
        sellerProfile: { include: { store: true } },
      },
    });

    // 2. Timing attack mitigation: verify dummy hash if user not found
    if (!user) {
      await argon2.verify(this.DUMMY_HASH, input.password).catch(() => false);
      throw new UnauthorizedError('Invalid email or password', ErrorCode.INVALID_CREDENTIALS);
    }

    // 3. Verify Argon2id password hash
    const isPasswordValid = await argon2.verify(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password', ErrorCode.INVALID_CREDENTIALS);
    }

    // 4. Check account active status
    if (!user.isActive) {
      throw new ForbiddenError(
        'Your account has been deactivated. Please contact support.',
        ErrorCode.FORBIDDEN_ACCESS
      );
    }

    // 5. Generate token family and tokens
    const familyId = crypto.randomUUID();
    const storeId = user.sellerProfile?.store?.id;

    const { token: accessToken, expiresInSeconds } = TokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      storeId,
      familyId,
    });

    const { token: refreshToken, expiresAt } = TokenService.generateRefreshToken();

    // 6. Persist hashed refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: TokenService.hashToken(refreshToken),
        familyId,
        expiresAt,
        userAgent: meta?.userAgent || null,
        ipAddress: meta?.ipAddress || null,
      },
    });

    logger.info('User logged in successfully', { userId: user.id, role: user.role });

    return {
      user: this.sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
    };
  }

  /**
   * Rotates a refresh token and detects token reuse (family revocation)
   * Guaranteed concurrency-safe via atomic conditional update
   */
  public static async refreshToken(
    refreshTokenStr: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResponseData> {
    if (!refreshTokenStr || typeof refreshTokenStr !== 'string' || refreshTokenStr.trim() === '') {
      throw new BadRequestError('Refresh token is required', ErrorCode.BAD_REQUEST);
    }

    const tokenHash = TokenService.hashToken(refreshTokenStr.trim());

    // 1. Initial lookup to verify token existence, revocation, or expiration
    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token', ErrorCode.TOKEN_INVALID);
    }

    // 2. Token reuse detection (old revoked token submitted)
    if (existingToken.isRevoked) {
      logger.error('CRITICAL: Refresh token reuse detected! Revoking entire token family.', {
        userId: existingToken.userId,
        familyId: existingToken.familyId,
      });

      // Persist immediate revocation of all sessions in this compromised family
      await prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { isRevoked: true },
      });

      // Invalidate active session access tokens in Redis
      await TokenService.revokeSession(existingToken.familyId);

      throw new UnauthorizedError(
        'Refresh token reuse detected. All active sessions in this family have been terminated for security.',
        ErrorCode.TOKEN_REUSE_DETECTED
      );
    }

    // 3. Expiration check
    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired', ErrorCode.TOKEN_EXPIRED);
    }

    // 4. Concurrency-safe atomic rotation inside a transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Atomic conditional update: only revoke if still unrevoked
        const updateResult = await tx.refreshToken.updateMany({
          where: {
            id: existingToken.id,
            isRevoked: false,
          },
          data: {
            isRevoked: true,
          },
        });

        // If count === 0, another concurrent request already rotated/consumed this token!
        if (updateResult.count === 0) {
          throw new ConcurrencyReuseDetectedError(existingToken.familyId);
        }

        // Fetch user and verify active status
        const user = await tx.user.findUnique({
          where: { id: existingToken.userId },
          include: {
            customerProfile: true,
            sellerProfile: { include: { store: true } },
          },
        });

        if (!user || !user.isActive) {
          throw new ForbiddenError(
            'User account is inactive or has been suspended',
            ErrorCode.FORBIDDEN_ACCESS
          );
        }

        const storeId = user.sellerProfile?.store?.id;

        // Issue new access token linked to the same session family
        const { token: newAccessToken, expiresInSeconds } = TokenService.generateAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role,
          storeId,
          familyId: existingToken.familyId,
        });

        // Issue new opaque refresh token
        const { token: newRefreshToken, expiresAt: newExpiresAt } =
          TokenService.generateRefreshToken();

        // Persist new hashed refresh token within the same family
        await tx.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: TokenService.hashToken(newRefreshToken),
            familyId: existingToken.familyId,
            expiresAt: newExpiresAt,
            userAgent: meta?.userAgent || existingToken.userAgent,
            ipAddress: meta?.ipAddress || existingToken.ipAddress,
          },
        });

        return {
          user: this.sanitizeUser(user),
          tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: expiresInSeconds,
            tokenType: 'Bearer' as const,
          },
        };
      });

      logger.info('Refresh token rotated successfully', { userId: result.user.id });
      return result;
    } catch (err) {
      if (err instanceof ConcurrencyReuseDetectedError) {
        // Handle concurrent rotation conflict: revoke the whole family immediately
        await prisma.refreshToken.updateMany({
          where: { familyId: err.familyId },
          data: { isRevoked: true },
        });
        await TokenService.revokeSession(err.familyId);

        logger.error(
          'CRITICAL: Concurrent refresh token rotation detected! Revoked entire family.',
          {
            familyId: err.familyId,
          }
        );

        throw new UnauthorizedError(
          'Refresh token reuse detected. All active sessions in this family have been terminated for security.',
          ErrorCode.TOKEN_REUSE_DETECTED
        );
      }
      throw err;
    }
  }

  /**
   * Logs out the current session by revoking the specified refresh token and access token
   */
  public static async logout(refreshTokenStr?: string, accessTokenJti?: string): Promise<void> {
    if (accessTokenJti) {
      await TokenService.revokeAccessToken(accessTokenJti);
    }

    if (!refreshTokenStr) return;
    try {
      const tokenHash = TokenService.hashToken(refreshTokenStr.trim());
      const tokenRecord = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (tokenRecord) {
        await prisma.refreshToken.updateMany({
          where: { id: tokenRecord.id, isRevoked: false },
          data: { isRevoked: true },
        });
        await TokenService.revokeSession(tokenRecord.familyId);
      }
      logger.info('User session logged out successfully');
    } catch (err) {
      logger.warn('Error during session logout', { error: (err as Error).message });
    }
  }

  /**
   * Logs out ALL active sessions across all devices for the user
   */
  public static async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    await TokenService.revokeAllUserSessions(userId);
    logger.info('All sessions revoked for user', { userId });
  }

  /**
   * Fetches the current authenticated user's profile
   */
  public static async getCurrentUser(userId: string): Promise<SanitizedUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerProfile: true,
        sellerProfile: { include: { store: true } },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Strips sensitive fields (like passwordHash) before sending User to API consumers
   */
  private static sanitizeUser(user: {
    id: string;
    email: string;
    role: UserRole;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    customerProfile?: CustomerProfile | null;
    sellerProfile?: (SellerProfile & { store?: Store | null }) | null;
  }): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      customerProfile: user.customerProfile
        ? {
            id: user.customerProfile.id,
            firstName: user.customerProfile.firstName,
            lastName: user.customerProfile.lastName,
            avatarUrl: user.customerProfile.avatarUrl,
          }
        : null,
      sellerProfile: user.sellerProfile
        ? {
            id: user.sellerProfile.id,
            panNumber: user.sellerProfile.panNumber,
            gstin: user.sellerProfile.gstin,
            kycVerified: user.sellerProfile.kycVerified,
            kycSubmittedAt: user.sellerProfile.kycSubmittedAt,
            kycApprovedAt: user.sellerProfile.kycApprovedAt,
            rejectionReason: user.sellerProfile.rejectionReason,
            store: user.sellerProfile.store
              ? {
                  id: user.sellerProfile.store.id,
                  name: user.sellerProfile.store.name,
                  slug: user.sellerProfile.store.slug,
                  status: user.sellerProfile.store.status,
                }
              : null,
          }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
