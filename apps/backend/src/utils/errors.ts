import { HttpStatus, HttpStatusCode } from '../constants/http-status';
import { ErrorCode, ErrorCodeType } from '../constants/error-codes';

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly errorCode: ErrorCodeType;
  public readonly details?: { field: string; message: string }[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCodeType = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: { field: string; message: string }[]
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = 'Bad request',
    errorCode: ErrorCodeType = ErrorCode.BAD_REQUEST,
    details?: { field: string; message: string }[]
  ) {
    super(message, HttpStatus.BAD_REQUEST, errorCode, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentication required',
    errorCode: ErrorCodeType = ErrorCode.AUTHENTICATION_REQUIRED
  ) {
    super(message, HttpStatus.UNAUTHORIZED, errorCode);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', errorCode: ErrorCodeType = ErrorCode.FORBIDDEN_ACCESS) {
    super(message, HttpStatus.FORBIDDEN, errorCode);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = 'Resource not found',
    errorCode: ErrorCodeType = ErrorCode.RESOURCE_NOT_FOUND
  ) {
    super(message, HttpStatus.NOT_FOUND, errorCode);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode: ErrorCodeType = ErrorCode.CONFLICT_ERROR) {
    super(message, HttpStatus.CONFLICT, errorCode);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = 'Too many requests, please try again later',
    errorCode: ErrorCodeType = ErrorCode.RATE_LIMIT_EXCEEDED
  ) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, errorCode);
  }
}
