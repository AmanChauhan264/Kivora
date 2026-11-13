import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { disconnectDatabase } from './config/database';
import { RedisService } from './config/redis';

const app = createApp();
const server = http.createServer(app);

function startServer(): http.Server {
  server.listen(env.PORT, () => {
    logger.info(`🚀 Kivora Central Backend API running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
      port: env.PORT,
      healthEndpoint: `http://localhost:${env.PORT}/api/v1/health`,
    });
  });

  return server;
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Disconnect resources
    await Promise.allSettled([disconnectDatabase(), RedisService.disconnect()]);

    logger.info('Graceful shutdown complete. Exiting process.');
    process.exit(0);
  });

  // Force exit if shutdown takes too long (10s timeout)
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
}

// Signal Listeners
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection detected', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

if (require.main === module) {
  startServer();
}

export { server, app };
