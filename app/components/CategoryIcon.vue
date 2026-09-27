<script setup lang="ts">
import type { Component } from 'vue'
import {
  Briefcase, Wallet, Coins, Banknote, HandCoins, PiggyBank, BadgeEuro, TrendingUp, CreditCard, Percent, Landmark, Receipt, Gift, TreePalm,
  House, Lightbulb, Zap, Droplet, Flame, Wifi, Smartphone, Tv, Wrench, Hammer, Sprout, ShieldCheck,
  ShoppingCart, ShoppingBasket, Utensils, Coffee, Pizza, Beer, Popcorn,
  Bike, Car, Fuel, TrainFront, Bus, Plane,
  HeartPulse, Pill, Stethoscope, Dumbbell, Scissors, Shirt, Baby, PawPrint,
  Gamepad2, Music, Film, Ticket, BookOpen, GraduationCap, Sparkles, HandHeart,
  ShoppingBag, Package, ArrowLeftRight, Repeat, Cigarette,
  CircleDashed,
} from 'lucide-vue-next'
import { EMOJI_TO_ICON, type CategoryIconName } from '~~/shared/utils/categoryIcons'

/**
 * A category's icon, by the NAME stored on the category ("shopping-cart").
 *
 *   null / empty  -> dashed circle: "not sorted yet"
 *   known name    -> the Lucide icon
 *   an old emoji  -> mapped to its Lucide replacement if we know it,
 *                    otherwise drawn as-is, so nothing ever shows blank
 *
 * Imported one by one (not the whole library), so only these ~60 icons end
 * up in the app.
 */
const ICONS: Record<CategoryIconName, Component> = {
  'briefcase': Briefcase, 'wallet': Wallet, 'coins': Coins, 'banknote': Banknote, 'hand-coins': HandCoins,
  'piggy-bank': PiggyBank, 'badge-euro': BadgeEuro, 'trending-up': TrendingUp, 'credit-card': CreditCard,
  'percent': Percent, 'landmark': Landmark, 'receipt': Receipt, 'gift': Gift, 'tree-palm': TreePalm,
  'house': House, 'lightbulb': Lightbulb, 'zap': Zap, 'droplet': Droplet, 'flame': Flame, 'wifi': Wifi,
  'smartphone': Smartphone, 'tv': Tv, 'wrench': Wrench, 'hammer': Hammer, 'sprout': Sprout, 'shield-check': ShieldCheck,
  'shopping-cart': ShoppingCart, 'shopping-basket': ShoppingBasket, 'utensils': Utensils, 'coffee': Coffee,
  'pizza': Pizza, 'beer': Beer, 'popcorn': Popcorn,
  'bike': Bike, 'car': Car, 'fuel': Fuel, 'train-front': TrainFront, 'bus': Bus, 'plane': Plane,
  'heart-pulse': HeartPulse, 'pill': Pill, 'stethoscope': Stethoscope, 'dumbbell': Dumbbell, 'scissors': Scissors,
  'shirt': Shirt, 'baby': Baby, 'paw-print': PawPrint,
  'gamepad-2': Gamepad2, 'music': Music, 'film': Film, 'ticket': Ticket, 'book-open': BookOpen,
  'graduation-cap': GraduationCap, 'sparkles': Sparkles, 'hand-heart': HandHeart,
  'shopping-bag': ShoppingBag, 'package': Package, 'arrow-left-right': ArrowLeftRight, 'repeat': Repeat, 'cigarette': Cigarette,
}

const props = withDefaults(defineProps<{ name?: string | null; size?: number }>(), { name: null, size: 18 })

const icon = computed<Component | null>(() => {
  if (!props.name) return CircleDashed
  return ICONS[props.name as CategoryIconName] ?? ICONS[EMOJI_TO_ICON[props.name]!] ?? null
})
</script>

<template>
  <component :is="icon" v-if="icon" :size="size" aria-hidden="true" />
  <span v-else class="legacy" aria-hidden="true">{{ name }}</span>
</template>

<style scoped>
.legacy { font-size: calc(v-bind(size) * 1px); line-height: 1; }
</style>
