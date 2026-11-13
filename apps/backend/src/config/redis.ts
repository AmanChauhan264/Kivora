import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export class RedisService {
  private static instance: Redis | null = null;
  private static isConnecting = false;

  public static getClient(): Redis {
    if (!RedisService.instance) {
      RedisService.initClient();
    }
    return RedisService.instance!;
  }

  private static initClient(): void {
    if (RedisService.isConnecting || RedisService.instance) return;
    RedisService.isConnecting = true;

    try {
      RedisService.instance = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) {
            logger.warn(`Redis connection retry limit reached (${times} attempts). Backing off.`);
            return null; // Stop retrying after 5 attempts
          }
          const delay = Math.min(times * 500, 3000);
          return delay;
        },
        lazyConnect: true,
        enableReadyCheck: true,
      });

      RedisService.instance.on('connect', () => {
        logger.info('Redis client connected');
      });

      RedisService.instance.on('ready', () => {
        logger.info('Redis client ready to accept commands');
      });

      RedisService.instance.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      RedisService.instance.on('close', () => {
        logger.warn('Redis connection closed');
      });
    } finally {
      RedisService.isConnecting = false;
    }
  }

  public static async checkHealth(): Promise<{
    isHealthy: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const client = RedisService.getClient();
      if (client.status !== 'ready') {
        await client.connect().catch((err) => {
          throw err;
        });
      }
      const pingResponse = await client.ping();
      if (pingResponse === 'PONG') {
        return {
          isHealthy: true,
          latencyMs: Date.now() - startTime,
        };
      }
      return {
        isHealthy: false,
        error: `Unexpected ping response: ${pingResponse}`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isHealthy: false,
        error: errorMessage,
      };
    }
  }

  public static async disconnect(): Promise<void> {
    if (RedisService.instance) {
      try {
        await RedisService.instance.quit();
        RedisService.instance = null;
        logger.info('Redis connection disconnected gracefully');
      } catch (err) {
        logger.error('Error during Redis client disconnect', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const redis = RedisService.getClient();
