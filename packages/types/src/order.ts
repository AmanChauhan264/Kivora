import { Address } from './user';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'PARTIALLY_CANCELLED'
  | 'CANCELLED'
  | 'EXPIRED';

export type SellerOrderStatus =
  'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  sellerOrderId: string;
  variantId?: string | null;
  productName: string;
  variantSku: string;
  attributes: Record<string, string>;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number; // Purchase-time applied tax rate % (e.g. 18.00)
  tax: number; // Tax amount
  totalPrice: number;
  imageUrl?: string | null;
  storeId: string;
  storeName: string;
}

export interface SellerOrder {
  id: string;
  orderId: string;
  storeId: string;
  status: SellerOrderStatus;
  currency: string;
  subtotal: number;
  shippingFee: number;
  platformFee: number; // Platform commission
  commissionGst: number; // GST on platform commission
  sellerEarnings: number; // subtotal - (platformFee + commissionGst)
  trackingNumber?: string | null;
  courierName?: string | null;
  shippedAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  cancellationReason?: string | null;
  items: OrderItem[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddressId: string;
  shippingAddressSnapshot: Record<string, unknown>; // Purchase-time immutable delivery address
  shippingAddress?: Address;
  paymentId?: string | null;
  sellerOrders: SellerOrder[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
