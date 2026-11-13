import { z } from 'zod';

export const updateStoreProfileSchema = z.object({
  name: z.string().trim().min(3, 'Store name must be at least 3 characters').optional(),
  description: z.string().trim().max(1000, 'Description too long').optional(),
  logoUrl: z.string().url('Invalid URL').optional().nullable(),
  bannerUrl: z.string().url('Invalid URL').optional().nullable(),
});

export const updateKycStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'REJECTED']),
  reason: z.string().optional(),
});

export type UpdateStoreProfileInput = z.infer<typeof updateStoreProfileSchema>;
export type UpdateKycStatusInput = z.infer<typeof updateKycStatusSchema>;
