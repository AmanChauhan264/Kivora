import type { UserRole } from '@prisma/client';

export type { UserRole };

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  storeId?: string;
  token_type: 'access';
  jti: string;
  familyId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface JwtRefreshPayload {
  sub: string;
  familyId: string;
  version?: number;
  token_type: 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface SanitizedCustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface SanitizedStore {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface SanitizedSellerProfile {
  id: string;
  panNumber: string;
  gstin: string | null;
  kycVerified: boolean;
  kycSubmittedAt: Date | null;
  kycApprovedAt: Date | null;
  rejectionReason: string | null;
  store: SanitizedStore | null;
}

export interface SanitizedUser {
  id: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  customerProfile: SanitizedCustomerProfile | null;
  sellerProfile: SanitizedSellerProfile | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // In seconds
  tokenType: 'Bearer';
}

export interface AuthResponseData {
  user: SanitizedUser;
  tokens: AuthTokens;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  storeId?: string;
  jti?: string;
  familyId?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
