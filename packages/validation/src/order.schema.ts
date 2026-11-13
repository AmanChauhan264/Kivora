import { z } from 'zod';

export const checkoutItemSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const checkoutIntentSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Cart cannot be empty'),
  shippingAddressId: z.string().uuid('Invalid shipping address ID'),
  couponCode: z.string().trim().optional(),
});

export const updateSellerOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  trackingNumber: z.string().trim().optional(),
  courierName: z.string().trim().optional(),
  cancellationReason: z.string().trim().optional(),
});

export const verifyPaymentSignatureSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature required'),
});

export type CheckoutIntentInput = z.infer<typeof checkoutIntentSchema>;
export type UpdateSellerOrderStatusInput = z.infer<typeof updateSellerOrderStatusSchema>;
export type VerifyPaymentSignatureInput = z.infer<typeof verifyPaymentSignatureSchema>;
