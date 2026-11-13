import { Request, Response } from 'express';
import { ApiResponseBuilder } from '../../utils/api-response';
import { checkDatabaseHealth } from '../../config/database';
import { RedisService } from '../../config/redis';
import { HttpStatus } from '../../constants/http-status';

export class HealthController {
  static async getHealth(_req: Request, res: Response): Promise<void> {
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = await RedisService.checkHealth();

    const isSystemHealthy = dbHealth.isHealthy && redisHealth.isHealthy;
    const isDegraded = !isSystemHealthy && (dbHealth.isHealthy || redisHealth.isHealthy);

    const healthData = {
      status: isSystemHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
      service: 'kivora-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      components: {
        database: {
          status: dbHealth.isHealthy ? 'up' : 'down',
          ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        },
        redis: {
          status: redisHealth.isHealthy ? 'up' : 'down',
          ...(redisHealth.latencyMs !== undefined ? { latencyMs: redisHealth.latencyMs } : {}),
        },
      },
    };

    const statusCode = isSystemHealthy
      ? HttpStatus.OK
      : isDegraded
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;

    ApiResponseBuilder.success(res, healthData, statusCode, 'Service health report generated');
  }
}
