-- Recurring payments + bills (plan 2026-11-16). ADDITIVE ONLY: two new tables,
-- three new enums, nothing touches an existing row or column.
--
-- Rollback (nothing else references these objects; run in this order):
--   DROP TABLE "RecurringSettlement";
--   DROP TABLE "RecurringItem";
--   DROP TYPE "RecurringSettlementKind";
--   DROP TYPE "RecurringDirection";
--   DROP TYPE "RecurringCadence";
--   (and DELETE FROM "_prisma_migrations" WHERE migration_name = '20261121100000_recurring_items';)

-- CreateEnum
CREATE TYPE "RecurringCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "RecurringSettlementKind" AS ENUM ('SKIPPED', 'MARKED_PAID');

-- CreateTable
CREATE TABLE "RecurringItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "match" TEXT NOT NULL,
    "amountMinCents" INTEGER NOT NULL,
    "amountMaxCents" INTEGER NOT NULL,
    "direction" "RecurringDirection" NOT NULL,
    "cadence" "RecurringCadence" NOT NULL,
    "anchorOn" DATE NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSettlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurringItemId" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "kind" "RecurringSettlementKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringItem_userId_idx" ON "RecurringItem"("userId");

-- CreateIndex
CREATE INDEX "RecurringSettlement_userId_idx" ON "RecurringSettlement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSettlement_recurringItemId_dueOn_key" ON "RecurringSettlement"("recurringItemId", "dueOn");

-- AddForeignKey
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSettlement" ADD CONSTRAINT "RecurringSettlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSettlement" ADD CONSTRAINT "RecurringSettlement_recurringItemId_fkey" FOREIGN KEY ("recurringItemId") REFERENCES "RecurringItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-added (Prisma's DSL cannot express CHECK constraints): the database
-- itself refuses a non-positive or inverted amount range. Amounts are on the
-- ABSOLUTE value (direction carries the sign), so both must be >= 1.
-- AddCheck
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_amounts_positive" CHECK ("amountMinCents" > 0 AND "amountMaxCents" > 0);

-- AddCheck
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_amount_range" CHECK ("amountMinCents" <= "amountMaxCents");
