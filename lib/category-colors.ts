export const CATEGORY_COLORS: Record<string, string> = {
  // Kosovë inherits the blue that was Politikë's — the section was renamed, not
  // restyled, and readers know that spotlight by its colour.
  'Kosovë':     '#0047FF',
  // Shqipëri takes the flag's red. It is the same hue the retired Siguri used,
  // which is free now that Siguri folds into Kosovë.
  'Shqipëri':   '#E41E20',
  // Kept: the store still holds rows filed under the old labels.
  'Politikë':   '#0047FF',
  'Ekonomi':    '#00A651',
  'Botë':       '#F59E0B',
  'Siguri':     '#E41E20',
  'Teknologji': '#7C3AED',
  'Kulturë':    '#F43F5E',
  // Sport sat on Kulturë's rose, one hue away from Showbiz's magenta. On the
  // homepage topic row those two land side by side as 3px bars and read as the
  // same colour, so Sport takes cyan — clear of Politikë's blue and Ekonomi's
  // green as well.
  'Sport':      '#06B6D4',
  'Shoqëri':    '#0047FF',
  'Showbiz':    '#E91E8C',
}

export const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  'Kosovë':     ['#0047FF', '#002299'],
  'Shqipëri':   ['#E41E20', '#7A0000'],
  'Politikë':   ['#0047FF', '#002299'],
  'Ekonomi':    ['#00A651', '#005C2D'],
  'Botë':       ['#F59E0B', '#B45309'],
  'Siguri':     ['#E41E20', '#7A0000'],
  'Teknologji': ['#7C3AED', '#4C1D95'],
  'Kulturë':    ['#F43F5E', '#9F1239'],
  'Sport':      ['#06B6D4', '#0E7490'],
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

function srgbChannel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function contrastRatio(a: number, b: number): number {
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

/**
 * The same category hue, driven dark enough to be read as small text.
 *
 * The palette above is tuned for pills and dots over photography, where a
 * saturated colour sits on a dark or tinted ground. Set as a 9–11px label on a
 * white card it fails badly: Sport's cyan scores 2.25:1 against #FFFFFF where
 * small text needs 4.5:1, and Ekonomi's green 2.96:1. Four of the seven
 * categories were unreadable at label size.
 *
 * Hue is preserved and the colour walked darker until it clears the threshold —
 * the approach `contrastSafeTeamColor` already takes for club kit colours in
 * lib/tregu-hub-market.mjs. A category that already passes is returned
 * untouched, so Kosovë's blue and Teknologji's violet are unaffected.
 */
export function getCategoryTextColor(category: string, background = '#FFFFFF'): string {
  const backgroundLuminance = relativeLuminance(parseHex(background))
  let rgb = parseHex(getCategoryColor(category))

  // Twenty-four steps of 0.86 reach black from any starting colour, so this
  // terminates whatever hues the palette grows later.
  for (
    let step = 0;
    step < 24 &&
    contrastRatio(relativeLuminance(rgb), backgroundLuminance) < 4.5;
    step += 1
  ) {
    rgb = [
      Math.round(rgb[0] * 0.86),
      Math.round(rgb[1] * 0.86),
      Math.round(rgb[2] * 0.86),
    ]
  }

  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
