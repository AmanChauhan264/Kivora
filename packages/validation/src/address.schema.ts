import { z } from 'zod';

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2, 'Recipient name is required'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  street: z.string().trim().min(5, 'Street address is required'),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Invalid 6-digit Indian PIN code'),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
