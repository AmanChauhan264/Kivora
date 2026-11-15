import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { ErrorCode } from '../constants/error-codes';

/**
 * Middleware to restrict endpoint access to specific UserRoles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new UnauthorizedError('Authentication required', ErrorCode.AUTHENTICATION_REQUIRED)
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: Requires one of the following roles: [${allowedRoles.join(', ')}]`,
          ErrorCode.FORBIDDEN_ACCESS
        )
      );
    }

    next();
  };
}

/**
 * Middleware ensuring a seller account has completed KYC and has an ACTIVE store
 */
export async function requireApprovedSeller(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    return next(
      new UnauthorizedError('Authentication required', ErrorCode.AUTHENTICATION_REQUIRED)
    );
  }

  if (req.user.role !== 'SELLER') {
    return next(
      new ForbiddenError('Access restricted to seller accounts', ErrorCode.FORBIDDEN_ACCESS)
    );
  }

  try {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.userId },
      include: { store: true },
    });

    if (!seller || !seller.kycVerified) {
      return next(
        new ForbiddenError(
          'Seller account is pending KYC approval. Active store management is restricted.',
          ErrorCode.SELLER_NOT_APPROVED
        )
      );
    }

    if (!seller.store || seller.store.status !== 'ACTIVE') {
      return next(
        new ForbiddenError(
          `Store is not active (status: ${seller.store?.status || 'NONE'}). Store management is restricted.`,
          ErrorCode.SELLER_NOT_APPROVED
        )
      );
    }

    // Attach verified storeId
    req.user.storeId = seller.store.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware ensuring a seller only accesses resources belonging to their own store
 */
export function requireStoreOwnership(paramName = 'storeId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(
        new UnauthorizedError('Authentication required', ErrorCode.AUTHENTICATION_REQUIRED)
      );
    }

    // Admins bypass store ownership checks for platform administration
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Extract target storeId from params, body, or query
    const targetStoreId =
      req.params[paramName] || req.body[paramName] || (req.query[paramName] as string);

    if (!targetStoreId) {
      return next(
        new ForbiddenError('Target store identifier missing from request', ErrorCode.BAD_REQUEST)
      );
    }

    if (req.user.role !== 'SELLER') {
      return next(new ForbiddenError('Only sellers can own stores', ErrorCode.FORBIDDEN_ACCESS));
    }

    try {
      // Determine user store ID from token claim or database
      let userStoreId = req.user.storeId;
      if (!userStoreId) {
        const seller = await prisma.sellerProfile.findUnique({
          where: { userId: req.user.userId },
          include: { store: true },
        });
        userStoreId = seller?.store?.id;
        if (userStoreId) req.user.storeId = userStoreId;
      }

      if (!userStoreId || userStoreId !== targetStoreId) {
        return next(
          new ForbiddenError(
            'Access denied: You do not have ownership of this store.',
            ErrorCode.UNAUTHORIZED_STORE_ACCESS
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
