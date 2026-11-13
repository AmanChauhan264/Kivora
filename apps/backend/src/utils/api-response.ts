import type { Response } from 'express';
import type { ApiSuccessResponse, ApiErrorResponse, PaginationMeta } from '@kivora/types';
import { HttpStatus, HttpStatusCode } from '../constants/http-status';
import { ErrorCode, ErrorCodeType } from '../constants/error-codes';

export class ApiResponseBuilder {
  static success<T>(
    res: Response,
    data: T,
    statusCode: HttpStatusCode = HttpStatus.OK,
    message?: string,
    meta?: PaginationMeta
  ): Response<ApiSuccessResponse<T>> {
    const responseBody: ApiSuccessResponse<T> = {
      success: true,
      statusCode,
      message,
      data,
      ...(meta ? { meta } : {}),
    };
    return res.status(statusCode).json(responseBody);
  }

  static error(
    res: Response,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string,
    errorCode: ErrorCodeType = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: { field: string; message: string }[]
  ): Response<ApiErrorResponse> {
    const responseBody: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      error: {
        code: errorCode,
        message,
        ...(details && details.length > 0 ? { details } : {}),
      },
    };
    return res.status(statusCode).json(responseBody);
  }
}
