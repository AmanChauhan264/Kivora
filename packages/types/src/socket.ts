import { OrderStatus, SellerOrderStatus } from './order';

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  updatedAt: Date | string;
}

export interface SellerOrderStatusChangedEvent {
  sellerOrderId: string;
  storeId: string;
  previousStatus: SellerOrderStatus;
  newStatus: SellerOrderStatus;
  updatedAt: Date | string;
}

export interface NewOrderNotificationEvent {
  sellerOrderId: string;
  storeId: string;
  subtotal: number;
  itemsCount: number;
  createdAt: Date | string;
}

export interface StockAlertEvent {
  storeId: string;
  variantId: string;
  productName: string;
  remainingQuantity: number;
  threshold: number;
}
