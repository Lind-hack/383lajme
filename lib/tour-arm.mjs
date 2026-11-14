/**
 * When a first-visit tour (components/spotlight-tour) takes over the screen.
 *
 * It used to wait for an IntersectionObserver to report the anchor at least
 * half inside a narrow band, and then for the reader to stop scrolling. A
 * fast flick skips both: the card can cross the band between two frames
 * without ever being reported, and a reader still scrolling carries on until
 * the tour finally opens far further down the page, or never. Every new
 * reader is meant to get it.
 *
 * So this is a position test, not a crossing: once the anchor's top is above
 * the arm line (TOUR_ARM_LINE of the viewport height, from the top), the tour
 * fires, including when a single frame has carried the card right off the top.
 */
export const TOUR_ARM_LINE = 0.8;

/**
 * @param {number} anchorTop the anchor's getBoundingClientRect().top
 * @param {number} viewportHeight window.innerHeight
 */
export function tourShouldFire(anchorTop, viewportHeight) {
  if (!(viewportHeight > 0)) return false;
  return anchorTop <= viewportHeight * TOUR_ARM_LINE;
}

/**
 * Whether a first-visit tour still owes this reader a showing.
 *
 * Tours share one "onboarded" flag so the product is taught once, not three
 * times across three pages. A standalone tour, the Tregu page explaining
 * itself to someone who has just arrived there, is the exception: it is owed
 * on its own first visit even after the homepage strip's tour has run.
 *
 * @param {{seenThis: boolean, onboarded: boolean, standalone: boolean}} state
 */
export function tourOwed({ seenThis, onboarded, standalone }) {
  if (seenThis) return false;
  return standalone || !onboarded;
}
