export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type EntryDirection = 'DEBIT' | 'CREDIT';

export interface FinancialAccount {
  id: string;
  accountNumber: string;
  name: string;
  type: AccountType;
  storeId?: string | null;
  currency: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface JournalTransaction {
  id: string;
  referenceKey: string;
  description: string;
  currency: string;
  source: string;
  postedAt: Date | string;
  isReversed: boolean;
  reversalOfId?: string | null;
  entries?: JournalEntry[];
}

export interface JournalEntry {
  id: string;
  transactionId: string;
  accountId: string;
  direction: EntryDirection;
  amount: number;
  currency: string;
  createdAt: Date | string;
}

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
  journalTransactionId?: string | null;
  type: LedgerEntryType;
  category: LedgerCategory;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string | null;
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
