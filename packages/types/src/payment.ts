export type PaymentStatus =
  'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  gatewayAttemptId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  rawResponse?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date | string;
}

export interface Payment {
  id: string;
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  amount: number; // Total paid in INR (rupees)
  currency: string; // "INR"
  status: PaymentStatus;
  errorMessage?: string | null;
  capturedAt?: Date | string | null;
  attempts?: PaymentAttempt[];
  refunds: PaymentRefund[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaymentRefund {
  id: string;
  paymentId: string;
  sellerOrderId?: string | null;
  razorpayRefundId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  createdAt: Date | string;
}

export interface ProcessedWebhook {
  id: string;
  eventId: string;
  eventType: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorLog?: string | null;
  createdAt: Date | string;
}
