import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import {
  customerRegisterSchema,
  sellerRegisterSchema,
  loginSchema,
  refreshTokenSchema,
  type CustomerRegisterInput,
  type SellerRegisterInput,
  type LoginInput,
  type RefreshTokenInput,
} from '@kivora/validation';

export {
  customerRegisterSchema,
  sellerRegisterSchema,
  loginSchema,
  refreshTokenSchema,
  type CustomerRegisterInput,
  type SellerRegisterInput,
  type LoginInput,
  type RefreshTokenInput,
};

/**
 * Middleware generator for validating request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}
