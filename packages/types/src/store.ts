export type StoreStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface Store {
  id: string;
  sellerProfileId: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  status: StoreStatus;
  commissionRate: number; // Percentage, e.g. 10.00
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StoreBalance {
  id: string;
  storeId: string;
  availableBalance: number; // Funds cleared and eligible for payout
  pendingBalance: number; // Funds locked in 7-day customer return window
  totalPaidOut: number; // Historical disbursements
  updatedAt: Date | string;
}
