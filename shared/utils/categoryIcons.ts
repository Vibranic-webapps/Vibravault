/**
 * The category icon set - Lucide icons, stored by NAME ("shopping-cart").
 *
 * Shared by the server (only these names are accepted) and the app (the
 * picker shows them in these groups; CategoryIcon draws them). Adding an
 * icon = add its name here AND its component in app/components/CategoryIcon.vue.
 */
export const CATEGORY_ICON_GROUPS = {
  money: ['briefcase', 'wallet', 'coins', 'banknote', 'hand-coins', 'piggy-bank', 'badge-euro', 'trending-up', 'credit-card', 'percent', 'landmark', 'receipt', 'gift', 'tree-palm'],
  home: ['house', 'lightbulb', 'zap', 'droplet', 'flame', 'wifi', 'smartphone', 'tv', 'wrench', 'hammer', 'sprout', 'shield-check'],
  food: ['shopping-cart', 'shopping-basket', 'utensils', 'coffee', 'pizza', 'beer', 'popcorn'],
  transport: ['bike', 'car', 'fuel', 'train-front', 'bus', 'plane'],
  care: ['heart-pulse', 'pill', 'stethoscope', 'dumbbell', 'scissors', 'shirt', 'baby', 'paw-print'],
  fun: ['gamepad-2', 'music', 'film', 'ticket', 'book-open', 'graduation-cap', 'sparkles', 'hand-heart'],
  other: ['shopping-bag', 'package', 'arrow-left-right', 'repeat', 'cigarette'],
} as const

export type CategoryIconName = (typeof CATEGORY_ICON_GROUPS)[keyof typeof CATEGORY_ICON_GROUPS][number]

export const CATEGORY_ICONS: readonly CategoryIconName[] = Object.values(CATEGORY_ICON_GROUPS).flat()

export function isCategoryIcon(value: unknown): value is CategoryIconName {
  return typeof value === 'string' && (CATEGORY_ICONS as readonly string[]).includes(value)
}

/**
 * The emoji categories used before (defaults + the old picker) and their
 * Lucide replacement. The migration 20260927180000_category_icons_lucide
 * converts stored data with exactly this table; CategoryIcon also uses it
 * so an emoji that slipped through still draws as the right icon.
 * Both forms of emoji that have a "variation selector" (🍽️ / 🍽) are listed.
 */
export const EMOJI_TO_ICON: Record<string, CategoryIconName> = {
  '💼': 'briefcase', '💰': 'coins', '🎁': 'gift', '🌴': 'tree-palm',
  '🛒': 'shopping-cart', '🏠': 'house', '💡': 'lightbulb', '🚲': 'bike',
  '📺': 'tv', '🍽️': 'utensils', '🍽': 'utensils', '🛍️': 'shopping-bag', '🛍': 'shopping-bag',
  '💊': 'pill', '📦': 'package', '🔁': 'repeat', '☕': 'coffee', '🎬': 'film',
  '✈️': 'plane', '✈': 'plane', '📱': 'smartphone', '🎓': 'graduation-cap',
  '🐾': 'paw-print', '🎵': 'music',
}
