/**
 * The tear line every pack shares: where the sealed strip ends and the
 * jagged edge it leaves, as CSS clip paths. Used by the opener (the strip
 * peeling off) and by the shelf (an opened pack keeps its torn top).
 */

/** Where the sealed strip ends, in % of the pack's height. */
export const TEAR_AT = 5.4;
/** Teeth along the tear line. */
const TEETH = 22;

function tearPoints() {
  const pts: string[] = [];
  for (let i = 0; i <= TEETH; i++) {
    const x = (i / TEETH) * 100;
    const y = TEAR_AT + (i % 2 === 0 ? 0.9 : -0.9);
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return pts;
}
const LINE = tearPoints();
/** The strip above the tear. */
export const STRIP_CLIP = `polygon(0% 0%, 100% 0%, ${[...LINE].reverse().join(", ")})`;
/** The pack below the tear: what an opened pack looks like. */
export const BODY_CLIP = `polygon(${LINE.join(", ")}, 100% 100%, 0% 100%)`;
