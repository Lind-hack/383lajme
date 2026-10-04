/**
 * Jigsaw pieces for the stamp card: the city's picture cut into one piece per
 * place. Rows of 3, 2 and 2 pieces (seven places); neighbours share every edge
 * exactly, so a tab on one piece is the blank on the next. Tabs sit away from
 * the corners where three pieces meet.
 *
 * Coordinates are in a W × H box (the scene's viewBox). Each piece is a list
 * of [x, y] points, clockwise, ready for an SVG polygon.
 */

/** Rows of pieces, top to bottom, and each row's share of the height. */
export const LAYOUT = [
  { cols: 3, h: 0.36 },
  { cols: 2, h: 0.32 },
  { cols: 2, h: 0.32 },
];

/**
 * A straight edge from P to Q with round jigsaw tabs. `tabs` are positions
 * along the edge (0..1) and which side they bulge to (+1 = left of travel,
 * -1 = right). Each point carries `k`, its position along the edge, so a
 * shared edge can be cut between two corners without splitting a tab.
 */
function edge(P, Q, tabs, size) {
  const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  const e = [(Q[0] - P[0]) / L, (Q[1] - P[1]) / L];
  const left = [-e[1], e[0]];
  const r = size;
  const n = r * 0.62;
  const h1 = r * 0.18;
  const pts = [{ x: P[0], y: P[1], k: 0 }];
  for (const { t, side } of [...tabs].sort((a, b) => a.t - b.t)) {
    const nrm = [left[0] * side, left[1] * side];
    const B = [P[0] + e[0] * t * L, P[1] + e[1] * t * L];
    const at = (u, v) => [B[0] + e[0] * u + nrm[0] * v, B[1] + e[1] * u + nrm[1] * v];
    const C = at(0, h1 + Math.sqrt(r * r - n * n));
    const A0 = at(-n, h1);
    const A1 = at(n, h1);
    const a0 = Math.atan2(A0[1] - C[1], A0[0] - C[0]);
    const a1 = Math.atan2(A1[1] - C[1], A1[0] - C[0]);
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    const sweep = delta - Math.sign(delta) * 2 * Math.PI; // the long way round: the knob
    const neck = [at(-n, 0), A0];
    for (const [x, y] of neck) pts.push({ x, y, k: t });
    const STEPS = 22;
    for (let i = 1; i < STEPS; i++) {
      const a = a0 + (sweep * i) / STEPS;
      pts.push({ x: C[0] + r * Math.cos(a), y: C[1] + r * Math.sin(a), k: t });
    }
    for (const [x, y] of [A1, at(n, 0)]) pts.push({ x, y, k: t });
  }
  pts.push({ x: Q[0], y: Q[1], k: 1 });
  return pts;
}

/** The part of an edge between positions k0 and k1, with exact end points. */
function slice(pts, k0, k1, P0, P1) {
  return [P0, ...pts.filter((p) => p.k > k0 + 1e-9 && p.k < k1 - 1e-9).map((p) => [p.x, p.y]), P1];
}

/**
 * Seven pieces in a W × H box: `[{ points, cx, cy }]`, row by row, left to
 * right. `seed` varies which way each tab bulges, so cities differ.
 */
export function puzzlePieces(W, H, seed = 0) {
  const rowsY = [0];
  for (const row of LAYOUT) rowsY.push(rowsY.at(-1) + row.h * H);
  rowsY[rowsY.length - 1] = H;
  const size = Math.min(W, H) * 0.062;
  let s = (seed >>> 0) || 1;
  const flip = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 16) & 1 ? 1 : -1;
  };

  // Horizontal boundaries between rows, full width, tabs placed between the
  // vertical cuts of both rows so no tab meets a corner.
  const horizontal = [];
  for (let r = 1; r < LAYOUT.length; r++) {
    const cuts = [...new Set([...cutsOf(LAYOUT[r - 1].cols), ...cutsOf(LAYOUT[r].cols)])].sort((a, b) => a - b);
    const marks = [0, ...cuts, 1];
    const tabs = [];
    // Only on stretches wide enough to keep the knob clear of the vertical cuts' own knobs.
    for (let i = 0; i < marks.length - 1; i++) if (marks[i + 1] - marks[i] >= 0.2) tabs.push({ t: (marks[i] + marks[i + 1]) / 2, side: flip() });
    horizontal.push(edge([0, rowsY[r]], [W, rowsY[r]], tabs, size));
  }
  // Vertical cuts inside each row, one tab at mid-height.
  const vertical = LAYOUT.map((row, r) =>
    cutsOf(row.cols).map((c) => ({ x: c, pts: edge([c * W, rowsY[r]], [c * W, rowsY[r + 1]], [{ t: 0.5, side: flip() }], size) }))
  );

  const pieces = [];
  LAYOUT.forEach((row, r) => {
    const xs = [0, ...cutsOf(row.cols), 1];
    for (let c = 0; c < row.cols; c++) {
      const x0 = xs[c], x1 = xs[c + 1];
      const y0 = rowsY[r], y1 = rowsY[r + 1];
      const TL = [x0 * W, y0], TR = [x1 * W, y0], BR = [x1 * W, y1], BL = [x0 * W, y1];
      const top = r === 0 ? [TL, TR] : slice(horizontal[r - 1], x0, x1, TL, TR);
      const rightEdge = vertical[r].find((v) => Math.abs(v.x - x1) < 1e-9);
      const right = rightEdge ? rightEdge.pts.map((p) => [p.x, p.y]) : [TR, BR];
      const bottom = r === LAYOUT.length - 1 ? [BR, BL] : slice(horizontal[r], x0, x1, BL, BR).reverse();
      const leftEdge = vertical[r].find((v) => Math.abs(v.x - x0) < 1e-9);
      const left = leftEdge ? leftEdge.pts.map((p) => [p.x, p.y]).reverse() : [BL, TL];
      const points = [...top, ...right.slice(1), ...bottom.slice(1), ...left.slice(1, -1)];
      pieces.push({ points, cx: ((x0 + x1) / 2) * W, cy: (y0 + y1) / 2 });
    }
  });
  return pieces;
}

function cutsOf(cols) {
  return Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols);
}

/** Polygon area (shoelace), for tests. */
export function area(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
