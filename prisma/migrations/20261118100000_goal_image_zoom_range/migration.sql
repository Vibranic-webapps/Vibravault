-- Goal picture zoom now goes below 100% (zoomed out) and up to 400%: range 50..400 (was 100..300).
-- Widening only: every stored value (100..300) stays valid, no data changes.
--
-- ROLLBACK (only safe while no row has a zoom outside 100..300; reset those first with
--   UPDATE "Goal" SET "imageZoom" = 100 WHERE "imageZoom" NOT BETWEEN 100 AND 300;):
--   ALTER TABLE "Goal" DROP CONSTRAINT "Goal_imageZoom_range";
--   ALTER TABLE "Goal" ADD CONSTRAINT "Goal_imageZoom_range" CHECK ("imageZoom" BETWEEN 100 AND 300);
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261118100000_goal_image_zoom_range';

ALTER TABLE "Goal" DROP CONSTRAINT "Goal_imageZoom_range";
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_imageZoom_range" CHECK ("imageZoom" BETWEEN 50 AND 400);
