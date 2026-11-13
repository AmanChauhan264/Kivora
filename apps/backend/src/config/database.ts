import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __kivoraPrismaClient: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });
}

export const prisma = global.__kivoraPrismaClient || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__kivoraPrismaClient = prisma;
}

export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      isHealthy: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('PostgreSQL health check failed', { error: errorMessage });
    return {
      isHealthy: false,
      error: errorMessage,
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('PostgreSQL client disconnected successfully');
  } catch (err) {
    logger.error('Error during PostgreSQL client disconnect', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
