import type { BinColor } from '@/types/rules'

// Shared by the canvas node, the inspector colour picker, and the exported app,
// so a bin looks the same everywhere. `item` is the trash that drops in when
// the bin's condition turns true — picked to suit what that colour usually collects.
export const BIN_COLORS: Record<BinColor, { label: string; fill: string; dark: string; glow: string; item: string }> = {
  blue:   { label: 'Blue',   fill: '#3B82F6', dark: '#1E40AF', glow: 'rgba(59,130,246,0.7)',  item: '🗞️' },
  green:  { label: 'Green',  fill: '#22C55E', dark: '#15803D', glow: 'rgba(34,197,94,0.7)',   item: '🍌' },
  yellow: { label: 'Yellow', fill: '#FACC15', dark: '#A16207', glow: 'rgba(250,204,21,0.7)',  item: '🥤' },
  red:    { label: 'Red',    fill: '#EF4444', dark: '#991B1B', glow: 'rgba(239,68,68,0.7)',   item: '🔋' },
  grey:   { label: 'Grey',   fill: '#9CA3AF', dark: '#4B5563', glow: 'rgba(156,163,175,0.7)', item: '🧻' },
  orange: { label: 'Orange', fill: '#F97316', dark: '#C2410C', glow: 'rgba(249,115,22,0.7)',  item: '🍾' },
}

export const BIN_COLOR_ORDER: BinColor[] = ['blue', 'green', 'yellow', 'red', 'grey', 'orange']

// New bins cycle through the classic three recycling colours.
export const DEFAULT_BIN_CYCLE: BinColor[] = ['blue', 'green', 'yellow']
