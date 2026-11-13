import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiResponseBuilder } from '../utils/api-response';
import { HttpStatus } from '../constants/http-status';
import { ErrorCode } from '../constants/error-codes';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn('Request validation failed', { requestId, details });
    ApiResponseBuilder.error(
      res,
      HttpStatus.BAD_REQUEST,
      'Input validation failed',
      ErrorCode.VALIDATION_ERROR,
      details
    );
    return;
  }

  // 2. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      logger.warn('Database unique constraint violation', { requestId, target });
      ApiResponseBuilder.error(
        res,
        HttpStatus.CONFLICT,
        `A record with this ${target} already exists.`,
        ErrorCode.CONFLICT_ERROR
      );
      return;
    }
    // Record not found
    if (err.code === 'P2025') {
      logger.warn('Database record not found', { requestId, code: err.code });
      ApiResponseBuilder.error(
        res,
        HttpStatus.NOT_FOUND,
        'The requested record does not exist or has been deleted.',
        ErrorCode.RESOURCE_NOT_FOUND
      );
      return;
    }
  }

  // 3. Fallback: Unhandled Internal Server Errors
  const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error('Unhandled internal server error', {
    requestId,
    error: errorMessage,
    stack: process.env.NODE_ENV !== 'production' ? stack : undefined,
  });

  ApiResponseBuilder.error(
    res,
    HttpStatus.INTERNAL_SERVER_ERROR,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : errorMessage,
    ErrorCode.INTERNAL_SERVER_ERROR
  );
}
