-- Kivora Migration: 20261113010000_integrity_and_accounting_refinements
-- Purpose: Add double-entry accounting, purchase-time order snapshots, payment attempts, review verification, and performance indexes.

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "EntryDirection" AS ENUM ('DEBIT', 'CREDIT');

-- DropIndex
DROP INDEX "Address_userId_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingAddressSnapshot" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "PaymentRefund" DROP COLUMN "status",
ADD COLUMN     "status" "RefundStatus" NOT NULL DEFAULT 'PROCESSED';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "orderItemId" TEXT,
ALTER COLUMN "isVerified" SET DEFAULT false;

-- AlterTable
ALTER TABLE "SellerLedgerEntry" ADD COLUMN     "journalTransactionId" TEXT;

-- AlterTable
ALTER TABLE "SellerOrder" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "StoreBalance" DROP COLUMN "pendingBalance",
ADD COLUMN     "pendingSettlementBalance" DECIMAL(14,2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "gatewayAttemptId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rawResponse" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "storeId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTransaction" (
    "id" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "source" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,

    CONSTRAINT "JournalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "EntryDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_gatewayAttemptId_key" ON "PaymentAttempt"("gatewayAttemptId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_accountNumber_key" ON "FinancialAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "FinancialAccount_type_idx" ON "FinancialAccount"("type");

-- CreateIndex
CREATE INDEX "FinancialAccount_storeId_idx" ON "FinancialAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTransaction_referenceKey_key" ON "JournalTransaction"("referenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTransaction_reversalOfId_key" ON "JournalTransaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalTransaction_postedAt_idx" ON "JournalTransaction"("postedAt");

-- CreateIndex
CREATE INDEX "JournalTransaction_source_idx" ON "JournalTransaction"("source");

-- CreateIndex
CREATE INDEX "JournalEntry_transactionId_idx" ON "JournalEntry"("transactionId");

-- CreateIndex
CREATE INDEX "JournalEntry_accountId_idx" ON "JournalEntry"("accountId");

-- CreateIndex
CREATE INDEX "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");

-- CreateIndex: Partial unique index guaranteeing at most one default address per user
CREATE UNIQUE INDEX "Address_user_single_default_idx" ON "Address"("userId") WHERE "isDefault" = true;

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE INDEX "PaymentRefund_sellerOrderId_idx" ON "PaymentRefund"("sellerOrderId");

-- CreateIndex
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_idx" ON "Product"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- CreateIndex
CREATE INDEX "SellerLedgerEntry_journalTransactionId_idx" ON "SellerLedgerEntry"("journalTransactionId");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTransaction" ADD CONSTRAINT "JournalTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "JournalTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerLedgerEntry" ADD CONSTRAINT "SellerLedgerEntry_journalTransactionId_fkey" FOREIGN KEY ("journalTransactionId") REFERENCES "JournalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
