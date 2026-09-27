-- Category icons: emoji -> Lucide icon NAMES (Redesign v2, 2026-09-27).
-- Data only: touches the icon column of categories that use one of the known
-- emoji; anything else (and every other column) is left alone. Same table as
-- EMOJI_TO_ICON in shared/utils/categoryIcons.ts. Reversible with that table.
UPDATE "Category" SET "icon" = CASE "icon"
  WHEN '💼' THEN 'briefcase'
  WHEN '💰' THEN 'coins'
  WHEN '🎁' THEN 'gift'
  WHEN '🌴' THEN 'tree-palm'
  WHEN '🛒' THEN 'shopping-cart'
  WHEN '🏠' THEN 'house'
  WHEN '💡' THEN 'lightbulb'
  WHEN '🚲' THEN 'bike'
  WHEN '📺' THEN 'tv'
  WHEN '🍽️' THEN 'utensils'
  WHEN '🍽' THEN 'utensils'
  WHEN '🛍️' THEN 'shopping-bag'
  WHEN '🛍' THEN 'shopping-bag'
  WHEN '💊' THEN 'pill'
  WHEN '📦' THEN 'package'
  WHEN '🔁' THEN 'repeat'
  WHEN '☕' THEN 'coffee'
  WHEN '🎬' THEN 'film'
  WHEN '✈️' THEN 'plane'
  WHEN '✈' THEN 'plane'
  WHEN '📱' THEN 'smartphone'
  WHEN '🎓' THEN 'graduation-cap'
  WHEN '🐾' THEN 'paw-print'
  WHEN '🎵' THEN 'music'
  ELSE "icon"
END
WHERE "icon" IN ('💼', '💰', '🎁', '🌴', '🛒', '🏠', '💡', '🚲', '📺', '🍽️', '🍽', '🛍️', '🛍', '💊', '📦', '🔁', '☕', '🎬', '✈️', '✈', '📱', '🎓', '🐾', '🎵');
