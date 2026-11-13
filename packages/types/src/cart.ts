import { ProductVariant } from './product';

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  variant?: ProductVariant;
  storeId: string;
  storeName: string;
}

export interface VendorCartGroup {
  storeId: string;
  storeName: string;
  items: CartItem[];
  subtotal: number;
}

export interface CartSummary {
  itemsCount: number;
  subtotal: number;
  estimatedShipping: number;
  estimatedTax: number;
  total: number;
  vendorGroups: VendorCartGroup[];
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  updatedAt: Date | string;
}
