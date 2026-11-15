-- AlterTable (additive: one NULLABLE column, existing rows are untouched)
ALTER TABLE "Category" ADD COLUMN     "budgetCents" INTEGER;

-- Hand-added (Prisma's DSL cannot express CHECK constraints): a budget is
-- either absent or a positive number of cents.
-- AddCheck
ALTER TABLE "Category" ADD CONSTRAINT "Category_budgetCents_positive" CHECK ("budgetCents" IS NULL OR "budgetCents" > 0);
