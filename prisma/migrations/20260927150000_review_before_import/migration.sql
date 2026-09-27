-- Review before import: rows shared via the Shortcut wait in PendingTransaction
-- until reviewed; rows removed in review are remembered by fingerprint only.
-- Additive only: two new tables, nothing existing is touched.
-- CreateTable
CREATE TABLE "PendingTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL,
    "counterparty" TEXT,
    "counterpartyIban" TEXT,
    "description" TEXT,
    "balanceAfterCents" INTEGER,
    "fingerprint" TEXT NOT NULL,
    "categoryId" TEXT,
    "filename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscardedFingerprint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscardedFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingTransaction_userId_idx" ON "PendingTransaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingTransaction_userId_fingerprint_key" ON "PendingTransaction"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "DiscardedFingerprint_userId_fingerprint_key" ON "DiscardedFingerprint"("userId", "fingerprint");

-- AddForeignKey
ALTER TABLE "PendingTransaction" ADD CONSTRAINT "PendingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingTransaction" ADD CONSTRAINT "PendingTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingTransaction" ADD CONSTRAINT "PendingTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscardedFingerprint" ADD CONSTRAINT "DiscardedFingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

