import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { RedisService } from '../../config/redis';
import { logger } from '../../utils/logger';
import { UnauthorizedError } from '../../utils/errors';
import { ErrorCode } from '../../constants/error-codes';
import type { JwtAccessPayload, JwtRefreshPayload } from './auth.types';

export class TokenService {
  private static readonly ISSUER = 'kivora-backend';
  private static readonly AUDIENCE = 'kivora-app';

  // In-memory fallback sets for token blacklisting if Redis is temporarily offline
  private static readonly memoryBlacklist = new Set<string>();

  /**
   * Generates a short-lived access JWT (default: 15 minutes) with explicit token_type and jti
   */
  public static generateAccessToken(
    payload: Omit<JwtAccessPayload, 'iss' | 'aud' | 'iat' | 'exp' | 'token_type' | 'jti'> & {
      jti?: string;
      familyId?: string;
    }
  ): {
    token: string;
    expiresInSeconds: number;
    jti: string;
  } {
    const expiresIn = env.JWT_ACCESS_EXPIRES_IN;
    const jti = payload.jti || crypto.randomUUID();

    const fullPayload: JwtAccessPayload = {
      ...payload,
      token_type: 'access',
      jti,
    };

    const token = jwt.sign(fullPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      issuer: this.ISSUER,
      audience: this.AUDIENCE,
    });

    const expiresInSeconds = this.parseExpiresInToSeconds(expiresIn, 900);

    return { token, expiresInSeconds, jti };
  }

  /**
   * Generates a cryptographically secure 256-bit (64 hex characters) opaque refresh token
   */
  public static generateRefreshToken(): {
    token: string;
    expiresAt: Date;
  } {
    const expiresIn = env.JWT_REFRESH_EXPIRES_IN;
    const expiresInSeconds = this.parseExpiresInToSeconds(expiresIn, 7 * 24 * 3600);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const token = crypto.randomBytes(32).toString('hex');

    return { token, expiresAt };
  }

  /**
   * Verifies and decodes an access token, validating token_type claim
   */
  public static verifyAccessToken(token: string): JwtAccessPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
      }) as JwtAccessPayload;

      if (decoded.token_type !== 'access') {
        throw new UnauthorizedError(
          'Invalid token type: expected access token',
          ErrorCode.TOKEN_INVALID
        );
      }

      return decoded;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired', ErrorCode.TOKEN_EXPIRED);
      }
      throw new UnauthorizedError(
        'Invalid access token signature or format',
        ErrorCode.TOKEN_INVALID
      );
    }
  }

  /**
   * Verifies and decodes a refresh JWT (if used), validating token_type claim
   */
  public static verifyRefreshToken(token: string): JwtRefreshPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
      }) as JwtRefreshPayload;

      if (decoded.token_type !== 'refresh') {
        throw new UnauthorizedError(
          'Invalid token type: expected refresh token',
          ErrorCode.TOKEN_INVALID
        );
      }

      return decoded;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token has expired', ErrorCode.TOKEN_EXPIRED);
      }
      throw new UnauthorizedError(
        'Invalid refresh token signature or format',
        ErrorCode.TOKEN_INVALID
      );
    }
  }

  /**
   * Produces a deterministic SHA-256 hex hash of a raw token string for safe database storage
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revokes an individual access token by jti (JWT ID) in Redis with TTL matching token expiry
   */
  public static async revokeAccessToken(jti: string, ttlSeconds = 900): Promise<void> {
    const key = `revoked:jti:${jti}`;
    try {
      const client = RedisService.getClient();
      if (client.status === 'ready') {
        await client.setex(key, ttlSeconds, 'revoked');
        return;
      }
    } catch (err) {
      logger.warn('Redis unavailable during token revocation, falling back to memory store', {
        jti,
        error: (err as Error).message,
      });
    }
    this.memoryBlacklist.add(key);
  }

  /**
   * Revokes an entire session family by familyId in Redis with TTL
   */
  public static async revokeSession(familyId: string, ttlSeconds = 900): Promise<void> {
    const key = `revoked:family:${familyId}`;
    try {
      const client = RedisService.getClient();
      if (client.status === 'ready') {
        await client.setex(key, ttlSeconds, 'revoked');
        return;
      }
    } catch (err) {
      logger.warn('Redis unavailable during session revocation, falling back to memory store', {
        familyId,
        error: (err as Error).message,
      });
    }
    this.memoryBlacklist.add(key);
  }

  /**
   * Revokes all active sessions for a user by recording a revocation timestamp
   */
  public static async revokeAllUserSessions(userId: string, ttlSeconds = 900): Promise<void> {
    const key = `revoked:user:${userId}`;
    const timestamp = Date.now().toString();
    try {
      const client = RedisService.getClient();
      if (client.status === 'ready') {
        await client.setex(key, ttlSeconds, timestamp);
        return;
      }
    } catch (err) {
      logger.warn('Redis unavailable during user revocation, falling back to memory store', {
        userId,
        error: (err as Error).message,
      });
    }
    this.memoryBlacklist.add(`${key}:${timestamp}`);
  }

  /**
   * Checks whether an access token is revoked in Redis or memory fallback
   */
  public static async isTokenRevoked(payload: JwtAccessPayload): Promise<boolean> {
    const jtiKey = `revoked:jti:${payload.jti}`;
    const familyKey = payload.familyId ? `revoked:family:${payload.familyId}` : null;
    const userKey = `revoked:user:${payload.sub}`;

    try {
      const client = RedisService.getClient();
      if (client.status === 'ready') {
        const keysToCheck = [jtiKey];
        if (familyKey) keysToCheck.push(familyKey);

        const results = await client.mget(keysToCheck);
        if (results.some((res) => res !== null)) {
          return true;
        }

        // Check user-level logoutAll timestamp
        const userRevokedAtStr = await client.get(userKey);
        if (userRevokedAtStr) {
          const userRevokedAtMs = parseInt(userRevokedAtStr, 10);
          const tokenIssuedAtMs = (payload.iat ?? 0) * 1000;
          if (tokenIssuedAtMs <= userRevokedAtMs) {
            return true;
          }
        }

        return false;
      }
    } catch (err) {
      logger.warn('Redis error during token revocation check, checking memory fallback', {
        error: (err as Error).message,
      });
    }

    // Memory fallback checks
    if (this.memoryBlacklist.has(jtiKey)) return true;
    if (familyKey && this.memoryBlacklist.has(familyKey)) return true;
    for (const entry of this.memoryBlacklist) {
      if (entry.startsWith(`${userKey}:`)) {
        const timestampStr = entry.substring(`${userKey}:`.length);
        const userRevokedAtMs = parseInt(timestampStr, 10);
        const tokenIssuedAtMs = (payload.iat ?? 0) * 1000;
        if (tokenIssuedAtMs <= userRevokedAtMs) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Converts a duration string (e.g., '15m', '7d', '3600s') to seconds
   */
  private static parseExpiresInToSeconds(duration: string, defaultSeconds: number): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) return defaultSeconds;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return defaultSeconds;
    }
  }
}
