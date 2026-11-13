import { z } from 'zod';

export const variantAttributeValueSchema = z.object({
  attributeName: z.string().trim().min(1, 'Attribute name is required'),
  value: z.string().trim().min(1, 'Attribute value is required'),
});

export const productVariantInputSchema = z.object({
  sku: z.string().trim().min(3, 'SKU must be at least 3 characters'),
  price: z.number().positive('Price must be greater than 0'),
  compareAtPrice: z.number().positive().optional().nullable(),
  attributes: z.array(variantAttributeValueSchema).min(1, 'Variant attributes are required'),
  quantity: z.number().int().nonnegative('Quantity cannot be negative'),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().trim().min(3, 'Product name must be at least 3 characters'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  variants: z.array(productVariantInputSchema).min(1, 'At least one product variant is required'),
  imagePublicIds: z.array(z.string()).min(1, 'At least one product image is required'),
});

export const updateInventorySchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().nonnegative('Quantity cannot be negative'),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
