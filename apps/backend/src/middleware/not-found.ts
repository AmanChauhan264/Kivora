import { Request, Response } from 'express';
import { ApiResponseBuilder } from '../utils/api-response';
import { HttpStatus } from '../constants/http-status';
import { ErrorCode } from '../constants/error-codes';

export function notFoundMiddleware(req: Request, res: Response): void {
  ApiResponseBuilder.error(
    res,
    HttpStatus.NOT_FOUND,
    `Route ${req.method} ${req.originalUrl} not found`,
    ErrorCode.RESOURCE_NOT_FOUND
  );
}
