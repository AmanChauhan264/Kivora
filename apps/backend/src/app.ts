import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { notFoundMiddleware } from './middleware/not-found';
import { errorHandlerMiddleware } from './middleware/error-handler';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';

export function createApp(): Application {
  const app: Application = express();

  // 1. Trust Proxy Configuration (for reverse proxies like Nginx, Cloudflare, ALB)
  app.set('trust proxy', 1);

  // 2. Security Headers
  app.use(helmet());

  // 3. CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (such as mobile apps or curl)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Safely reject untrusted origin without triggering a 500 error
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-request-id',
        'x-requested-with',
        'x-csrf-token',
      ],
    })
  );

  // 3. Body & Cookie Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // 4. Request Observability (ID & Logging)
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // 5. API V1 Routes
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/auth', authRoutes);

  // 6. 404 Not Found Handling
  app.use(notFoundMiddleware);

  // 7. Centralized Error Handling
  app.use(errorHandlerMiddleware);

  return app;
}
