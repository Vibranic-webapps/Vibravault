-- Recurring suggestions, phase 1b ("Not now" memory, 30 days). ADDITIVE ONLY:
-- one new table, nothing touches an existing row, column or enum.
--
-- Rollback (nothing else references this table):
--   DROP TABLE "RecurringSuggestionDismissal";
--   (and DELETE FROM "_prisma_migrations" WHERE migration_name = '20261122100000_recurring_suggestion_dismissal';)

-- CreateTable
CREATE TABLE "RecurringSuggestionDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSuggestionDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSuggestionDismissal_userId_key_key" ON "RecurringSuggestionDismissal"("userId", "key");

-- AddForeignKey
ALTER TABLE "RecurringSuggestionDismissal" ADD CONSTRAINT "RecurringSuggestionDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
