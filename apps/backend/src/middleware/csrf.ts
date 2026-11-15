import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ForbiddenError } from '../utils/errors';
import { ErrorCode } from '../constants/error-codes';

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0 && origin !== '*');

/**
 * Validates Origin/Referer and custom anti-CSRF header when authenticating via ambient cookies
 */
export function validateCsrfForCookieAuth(req: Request): void {
  // 1. Origin / Referer validation
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  let requestOrigin: string | undefined;

  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      const parsed = new URL(referer);
      requestOrigin = parsed.origin;
    } catch {
      // Malformed referer header
    }
  }

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    throw new ForbiddenError(
      'CSRF validation failed: Invalid or untrusted origin',
      ErrorCode.FORBIDDEN_ACCESS
    );
  }

  // 2. Custom header validation (e.g. X-Requested-With or X-CSRF-Token)
  const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
  if (!customHeader) {
    throw new ForbiddenError(
      'CSRF validation failed: Missing required custom header (X-Requested-With or X-CSRF-Token)',
      ErrorCode.FORBIDDEN_ACCESS
    );
  }
}

/**
 * Route middleware for state-changing endpoints that may accept cookies (e.g. /refresh, /logout).
 * If the request uses explicit credentials (Bearer token or explicit body.refreshToken), CSRF is not required.
 * If the request relies on ambient cookies, CSRF defense is strictly enforced.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');
  const hasBodyToken = Boolean(
    req.body && typeof req.body === 'object' && 'refreshToken' in req.body && req.body.refreshToken
  );

  // If credentials are explicitly passed in body or Authorization header, ambient CSRF is not possible
  if (hasBearer || hasBodyToken) {
    return next();
  }

  const hasCookie = Boolean(
    req.cookies && (req.cookies.kivora_refresh_token || req.cookies.kivora_access_token)
  );

  // If request relies on cookies, enforce CSRF validation
  if (hasCookie) {
    validateCsrfForCookieAuth(req);
  }

  next();
}
