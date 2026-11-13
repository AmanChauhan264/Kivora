export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  commissionRate: number; // e.g. 10.0 for 10%
  imageUrl?: string | null;
  children?: Category[];
}

export interface ProductAttribute {
  id: string;
  name: string; // e.g., "Size", "Color"
  values: string[]; // e.g., ["8", "9", "10"] or ["Tan", "Espresso"]
}

export interface VariantAttributeValue {
  attributeName: string;
  value: string;
}

export interface InventoryItem {
  id: string;
  variantId: string;
  quantity: number; // Physical on-hand stock
  reservedQuantity: number; // Locked during checkout intent (15m TTL)
  lowStockThreshold: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  price: number; // In INR (rupees or paise as standardized)
  compareAtPrice?: number | null;
  attributes: VariantAttributeValue[];
  inventory?: InventoryItem | null;
  isAvailable: boolean;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  publicId: string; // Cloudinary public ID
  isPrimary: boolean;
  order: number;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: ProductStatus;
  images: ProductImage[];
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
