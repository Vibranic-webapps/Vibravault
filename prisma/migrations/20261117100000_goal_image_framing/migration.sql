-- Goal picture framing: where the picture is focused inside the card, and how far it is zoomed.
-- ADDITIVE: three NOT NULL columns WITH defaults, so existing rows get 50/50/100 (centred, no zoom)
-- and nothing is lost. The framing is applied in CSS, never baked into the stored bytes.
--
-- ROLLBACK (safe: only drops what this migration added; pictures and goals are untouched):
--   ALTER TABLE "Goal" DROP CONSTRAINT "Goal_imageFocusX_range";
--   ALTER TABLE "Goal" DROP CONSTRAINT "Goal_imageFocusY_range";
--   ALTER TABLE "Goal" DROP CONSTRAINT "Goal_imageZoom_range";
--   ALTER TABLE "Goal" DROP COLUMN "imageFocusX", DROP COLUMN "imageFocusY", DROP COLUMN "imageZoom";
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261117100000_goal_image_framing';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "imageFocusX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "imageFocusY" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "imageZoom" INTEGER NOT NULL DEFAULT 100;

-- Hand-added (Prisma's DSL cannot express CHECK constraints): the focus point is a percentage
-- and the zoom is 100% (none) up to 300% (3x).
-- AddCheck
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_imageFocusX_range" CHECK ("imageFocusX" BETWEEN 0 AND 100);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_imageFocusY_range" CHECK ("imageFocusY" BETWEEN 0 AND 100);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_imageZoom_range" CHECK ("imageZoom" BETWEEN 100 AND 300);
