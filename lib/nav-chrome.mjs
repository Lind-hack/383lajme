/**
 * Phone chrome that gets out of the way while reading (components/navbar).
 *
 * Scrolling down hides the header, and scrolling up brings it back. `anchorY`
 * is where the current run of scrolling in one direction began, or the last
 * point it reached. The header flips only after the reader moves SCROLL_SLOP
 * pixels against the run, so a thumb jitter or a momentum wobble does not make
 * it flicker. Inside HEADER_ZONE (the header's own height) it is always shown,
 * so the top of every page looks the way it was designed.
 */
export const HEADER_ZONE = 72;
export const SCROLL_SLOP = 10;

/**
 * @param {{hidden: boolean, anchorY: number}} state
 * @param {number} y current window.scrollY
 * @returns {{hidden: boolean, anchorY: number}}
 */
export function nextChromeState(state, y) {
  if (y <= HEADER_ZONE) return { hidden: false, anchorY: Math.max(0, y) };
  const delta = y - state.anchorY;
  if (state.hidden) {
    // Hidden: keep following the scroll down; show on a real move up.
    if (delta > 0) return { hidden: true, anchorY: y };
    if (-delta > SCROLL_SLOP) return { hidden: false, anchorY: y };
    return state;
  }
  // Shown: keep following the scroll up; hide on a real move down.
  if (delta < 0) return { hidden: false, anchorY: y };
  if (delta > SCROLL_SLOP) return { hidden: true, anchorY: y };
  return state;
}

/** Dardani's idle wiggle comes every 10–15s. `r` is in [0, 1). */
export function wiggleDelay(r) {
  return 10_000 + Math.round(r * 5_000);
}
