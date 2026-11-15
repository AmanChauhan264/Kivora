import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { ApiResponseBuilder } from '../../utils/api-response';
import { HttpStatus } from '../../constants/http-status';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { BadRequestError } from '../../utils/errors';
import { ErrorCode } from '../../constants/error-codes';

export class AuthController {
  private static readonly REFRESH_COOKIE_NAME = 'kivora_refresh_token';

  /**
   * Helper to set secure HttpOnly refresh token cookie
   */
  private static setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(this.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });
  }

  /**
   * Helper to clear refresh token cookie
   */
  private static clearRefreshCookie(res: Response): void {
    res.clearCookie(this.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/api/v1/auth',
    });
  }

  /**
   * Extracts client request metadata (IP and User-Agent)
   */
  private static getClientMeta(req: Request): { userAgent?: string; ipAddress?: string } {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    return { userAgent, ipAddress };
  }

  /**
   * POST /api/v1/auth/register/customer
   */
  public static async registerCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const meta = AuthController.getClientMeta(req);
      const data = await AuthService.registerCustomer(req.body, meta);

      AuthController.setRefreshCookie(res, data.tokens.refreshToken);

      ApiResponseBuilder.success(
        res,
        data,
        HttpStatus.CREATED,
        'Customer account created successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/register/seller
   */
  public static async registerSeller(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const meta = AuthController.getClientMeta(req);
      const data = await AuthService.registerSeller(req.body, meta);

      AuthController.setRefreshCookie(res, data.tokens.refreshToken);

      ApiResponseBuilder.success(
        res,
        data,
        HttpStatus.CREATED,
        'Seller account registered successfully. Store is pending KYC approval.'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = AuthController.getClientMeta(req);
      const data = await AuthService.login(req.body, meta);

      AuthController.setRefreshCookie(res, data.tokens.refreshToken);

      ApiResponseBuilder.success(res, data, HttpStatus.OK, 'Authentication successful');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Refresh token can be in request body (Mobile/API) or HttpOnly cookie (Web)
      const token = req.body?.refreshToken || req.cookies?.[AuthController.REFRESH_COOKIE_NAME];

      if (!token) {
        throw new BadRequestError(
          'Refresh token is required in request body or cookie',
          ErrorCode.BAD_REQUEST
        );
      }

      const meta = AuthController.getClientMeta(req);
      const data = await AuthService.refreshToken(token, meta);

      AuthController.setRefreshCookie(res, data.tokens.refreshToken);

      ApiResponseBuilder.success(res, data, HttpStatus.OK, 'Token rotated successfully');
    } catch (err) {
      // Clear cookie on refresh error to prevent browser retry loops
      AuthController.clearRefreshCookie(res);
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.body?.refreshToken || req.cookies?.[AuthController.REFRESH_COOKIE_NAME];

      let accessTokenJti: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const rawToken = authHeader.substring(7).trim();
          const decoded = TokenService.verifyAccessToken(rawToken);
          accessTokenJti = decoded.jti;
          if (decoded.familyId) {
            await TokenService.revokeSession(decoded.familyId);
          }
        } catch {
          // Token may already be expired or invalid, proceed with refresh token logout
        }
      }

      await AuthService.logout(token, accessTokenJti);

      AuthController.clearRefreshCookie(res);

      ApiResponseBuilder.success(
        res,
        { loggedOut: true },
        HttpStatus.OK,
        'Session logged out successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout-all
   */
  public static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await AuthService.logoutAll(userId);

      AuthController.clearRefreshCookie(res);

      ApiResponseBuilder.success(
        res,
        { loggedOutAll: true },
        HttpStatus.OK,
        'All active sessions terminated across all devices'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.getCurrentUser(userId);

      ApiResponseBuilder.success(
        res,
        { user },
        HttpStatus.OK,
        'Current authenticated user profile'
      );
    } catch (err) {
      next(err);
    }
  }
}
