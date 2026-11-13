import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const customerRegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Invalid 10-digit Indian mobile number')
    .optional(),
});

export const sellerRegisterSchema = customerRegisterSchema.extend({
  storeName: z.string().trim().min(3, 'Store name must be at least 3 characters'),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid Indian PAN format (e.g. ABCDE1234F)'),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address format'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type SellerRegisterInput = z.infer<typeof sellerRegisterSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
