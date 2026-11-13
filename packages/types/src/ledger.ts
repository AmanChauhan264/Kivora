export type LedgerEntryType = 'CREDIT' | 'DEBIT' | 'PAYOUT';

export type LedgerCategory =
  | 'ORDER_EARNINGS'
  | 'COMMISSION_FEE'
  | 'COMMISSION_GST'
  | 'REFUND_REVERSAL'
  | 'PAYOUT_DISBURSEMENT';

export type PayoutStatus = 'PENDING' | 'ELIGIBLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SellerLedgerEntry {
  id: string;
  storeId: string;
  sellerOrderId?: string | null;
  payoutId?: string | null;
  type: LedgerEntryType;
  category: LedgerCategory;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: Date | string;
}

export interface SellerPayout {
  id: string;
  storeId: string;
  amount: number;
  status: PayoutStatus;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankReferenceNumber?: string | null; // UTR Number
  processedAt?: Date | string | null;
  failureReason?: string | null;
  createdAt: Date | string;
}
