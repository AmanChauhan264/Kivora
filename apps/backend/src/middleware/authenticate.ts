import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../modules/auth/token.service';
import { UnauthorizedError } from '../utils/errors';
import { ErrorCode } from '../constants/error-codes';
import { validateCsrfForCookieAuth } from './csrf';

/**
 * Middleware to verify short-lived access JWT from Authorization header or HttpOnly cookie
 */
export async function authenticateAccessToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to HttpOnly cookie (for browser web clients)
    if (!token && req.cookies && req.cookies.kivora_access_token) {
      // Validate CSRF before accepting ambient cookie authentication
      validateCsrfForCookieAuth(req);
      token = req.cookies.kivora_access_token;
    }

    if (!token) {
      throw new UnauthorizedError(
        'Authentication required. Please provide a valid Bearer token.',
        ErrorCode.AUTHENTICATION_REQUIRED
      );
    }

    // 3. Verify signature, expiration, issuer, audience, and token_type
    const decoded = TokenService.verifyAccessToken(token);

    // 4. Check revocation against Redis blacklist / memory fallback
    const isRevoked = await TokenService.isTokenRevoked(decoded);
    if (isRevoked) {
      throw new UnauthorizedError(
        'Access token has been revoked. Please re-authenticate.',
        ErrorCode.TOKEN_EXPIRED
      );
    }

    // 5. Attach authenticated user context
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      storeId: decoded.storeId,
      jti: decoded.jti,
      familyId: decoded.familyId,
    };

    next();
  } catch (err) {
    next(err);
  }
}
