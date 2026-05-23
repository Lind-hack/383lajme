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

export const DEFAULT_COLOR = '#FF4422'

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR
}

export function getCategoryBg(category: string, alpha = 0.1): string {
  const hex = getCategoryColor(category)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
