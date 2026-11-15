-- AlterTable (additive: one NOT NULL column WITH a default, existing rows get false)
ALTER TABLE "Category" ADD COLUMN     "isSubscription" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the seeded "Subscriptions" expense category is a subscription
-- category. Other categories are left for the user to flag themselves.
UPDATE "Category" SET "isSubscription" = true WHERE "kind" = 'EXPENSE' AND "name" = 'Subscriptions';
