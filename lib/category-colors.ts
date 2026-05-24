export const CATEGORY_COLORS: Record<string, string> = {
  'Politikë':   '#0047FF',
  'Ekonomi':    '#00A651',
  'Botë':       '#F59E0B',
  'Siguri':     '#E41E20',
  'Teknologji': '#7C3AED',
  'Kulturë':    '#F43F5E',
  'Sport':      '#F43F5E',
  'Shoqëri':    '#0047FF',
  'Showbiz':    '#E91E8C',
}

export const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  'Politikë':   ['#0047FF', '#002299'],
  'Ekonomi':    ['#00A651', '#005C2D'],
  'Botë':       ['#F59E0B', '#B45309'],
  'Siguri':     ['#E41E20', '#7A0000'],
  'Teknologji': ['#7C3AED', '#4C1D95'],
  'Kulturë':    ['#F43F5E', '#9F1239'],
  'Sport':      ['#F43F5E', '#9F1239'],
  'Shoqëri':    ['#0047FF', '#002299'],
  'Showbiz':    ['#E91E8C', '#9D0B60'],
  'Diasporë':   ['#FF4422', '#CC2200'],
}

export const CATEGORY_LIGHT_BG = new Set(['Botë'])

export const DEFAULT_COLOR = '#FF4422'

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR
}

export function getCategoryGradient(category: string): [string, string] {
  return CATEGORY_GRADIENTS[category] ?? ['#FF4422', '#CC2200']
}

export function getCategoryBg(category: string, alpha = 0.1): string {
  const hex = getCategoryColor(category)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
