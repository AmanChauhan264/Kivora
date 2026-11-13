import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { notFoundMiddleware } from './middleware/not-found';
import { errorHandlerMiddleware } from './middleware/error-handler';
import { healthRoutes } from './modules/health/health.routes';

export function createApp(): Application {
  const app: Application = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (such as mobile apps or curl) or if origin is in allowedOrigins
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} is not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // 3. Body Parsers (Sensible limits)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Request Observability (ID & Logging)
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // 5. API V1 Routes
  app.use('/api/v1', healthRoutes);

  // 6. 404 Not Found Handling
  app.use(notFoundMiddleware);

  // 7. Centralized Error Handling
  app.use(errorHandlerMiddleware);

  return app;
}
