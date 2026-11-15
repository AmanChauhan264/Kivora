import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../config/redis';
import { ApiResponseBuilder } from '../utils/api-response';
import { HttpStatus } from '../constants/http-status';
import { ErrorCode } from '../constants/error-codes';
import { logger } from '../utils/logger';

interface RateLimiterOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix: string;
}

// In-memory fallback map if Redis is offline
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Creates a rate limiting middleware using Redis with in-memory fallback
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { windowSeconds, maxRequests, prefix } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Determine client identifier (using Express req.ip configured with trusted reverse proxy)
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const key = `ratelimit:${prefix}:${ip}`;

    try {
      const client = RedisService.getClient();

      // Check if Redis is ready
      if (client.status === 'ready') {
        const multi = client.multi();
        multi.incr(key);
        multi.ttl(key);
        const results = await multi.exec();

        if (results && results[0] && results[1]) {
          const count = results[0][1] as number;
          let ttl = results[1][1] as number;

          // If key was just created without TTL, set TTL
          if (ttl === -1) {
            await client.expire(key, windowSeconds);
            ttl = windowSeconds;
          }

          res.setHeader('RateLimit-Limit', maxRequests);
          res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - count));
          res.setHeader('RateLimit-Reset', Math.max(1, ttl));

          if (count > maxRequests) {
            res.setHeader('Retry-After', ttl);
            logger.warn('Rate limit exceeded (Redis)', { ip, prefix, count, limit: maxRequests });
            ApiResponseBuilder.error(
              res,
              HttpStatus.TOO_MANY_REQUESTS,
              `Too many requests. Please try again after ${ttl} seconds.`,
              ErrorCode.RATE_LIMIT_EXCEEDED
            );
            return;
          }

          return next();
        }
      }
    } catch (redisErr) {
      logger.warn('Redis rate limiter encountered error, falling back to memory store', {
        error: (redisErr as Error).message,
      });
    }

    // In-memory fallback
    const now = Date.now();
    const memoryRecord = memoryStore.get(key);

    if (!memoryRecord || memoryRecord.resetAt < now) {
      memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      res.setHeader('RateLimit-Limit', maxRequests);
      res.setHeader('RateLimit-Remaining', maxRequests - 1);
      res.setHeader('RateLimit-Reset', windowSeconds);
      return next();
    }

    memoryRecord.count += 1;
    const remainingTtlSeconds = Math.ceil((memoryRecord.resetAt - now) / 1000);

    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - memoryRecord.count));
    res.setHeader('RateLimit-Reset', remainingTtlSeconds);

    if (memoryRecord.count > maxRequests) {
      res.setHeader('Retry-After', remainingTtlSeconds);
      logger.warn('Rate limit exceeded (Memory fallback)', {
        ip,
        prefix,
        count: memoryRecord.count,
      });
      ApiResponseBuilder.error(
        res,
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many requests. Please try again after ${remainingTtlSeconds} seconds.`,
        ErrorCode.RATE_LIMIT_EXCEEDED
      );
      return;
    }

    return next();
  };
}

// Pre-configured rate limiters
export const loginRateLimiter = createRateLimiter({
  windowSeconds: 15 * 60, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 minutes per IP
  prefix: 'login',
});

export const registerRateLimiter = createRateLimiter({
  windowSeconds: 60 * 60, // 1 hour
  maxRequests: 15, // 15 registrations per hour per IP
  prefix: 'register',
});

export const refreshRateLimiter = createRateLimiter({
  windowSeconds: 15 * 60, // 15 minutes
  maxRequests: 30, // 30 refresh requests per 15 minutes
  prefix: 'refresh',
});
