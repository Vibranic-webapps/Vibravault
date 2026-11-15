-- AlterTable (additive: four NULLABLE columns, existing rows are untouched)
ALTER TABLE "Goal" ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMime" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "tint" TEXT;

-- Hand-added (Prisma's DSL cannot express CHECK constraints): picture bytes and
-- their content type always travel together, so a row can never hold bytes the
-- image route would not know how to label.
-- AddCheck
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_image_data_mime_together" CHECK (("imageData" IS NULL) = ("imageMime" IS NULL));
