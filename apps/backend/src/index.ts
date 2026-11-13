/**
 * Kivora Backend Entrypoint Stub
 * Full Express & Prisma architecture initialized in Phase 2
 */
import { UserRole } from '@kivora/types';
import { loginSchema } from '@kivora/validation';

export const backendInfo = {
  service: 'kivora-backend',
  version: '1.0.0',
  supportedRoles: ['CUSTOMER', 'SELLER', 'ADMIN'] as UserRole[],
  isValidationReady: typeof loginSchema.parse === 'function',
};
