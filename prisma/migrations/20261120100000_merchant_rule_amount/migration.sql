-- AlterTable: optional amount condition on a merchant rule (cents, absolute
-- value; both NULL = any amount). Additive and nullable - existing rules are
-- unchanged. Rollback: ALTER TABLE "MerchantRule" DROP COLUMN "amountMinCents", DROP COLUMN "amountMaxCents";
ALTER TABLE "MerchantRule" ADD COLUMN "amountMinCents" INTEGER,
ADD COLUMN "amountMaxCents" INTEGER;
