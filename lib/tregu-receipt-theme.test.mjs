import test from "node:test";
import assert from "node:assert/strict";

import {
  receiptTheme,
  normalizeHex,
  isAchromaticPale,
  compositeOver,
  contrastRatio,
  relativeLuminance,
} from "./tregu-receipt-theme.mjs";

const theme = (primary, alternate, fallback) => receiptTheme({ primary, alternate, fallback });

/** The contrast the reader actually gets: ink over the stop, after the scrim. */
const effective = (t) =>
  Math.min(
    contrastRatio(t.ink, compositeOver(t.scrim, t.from, t.scrimAlpha)),
    contrastRatio(t.ink, compositeOver(t.scrim, t.to, t.scrimAlpha))
  );

test("normalizeHex accepts the shapes ESPN and CSS actually produce", () => {
  assert.equal(normalizeHex("a50044"), "#A50044");
  assert.equal(normalizeHex("#a50044"), "#A50044");
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("  004D98 "), "#004D98");
  for (const bad of [null, undefined, "", "red", "#12345", "#1234567", 0xa50044]) {
    assert.equal(normalizeHex(bad), null);
  }
});

test("the pale-kit test catches white without catching a saturated yellow", () => {
  assert.equal(isAchromaticPale("#FFFFFF"), true);
  assert.equal(isAchromaticPale("#FDFDFD"), true);
  // Dortmund. Fully saturated and light — a ground, not a blank.
  assert.equal(isAchromaticPale("#FDE100"), false);
  assert.equal(isAchromaticPale("#A50044"), false);
});

test("Barcelona keeps garnet and blue — the defect this module exists to fix", () => {
  const t = theme("a50044", "004d98");
  assert.equal(t.from, "#A50044");
  assert.equal(t.to, "#004D98", "the club's own second colour must survive");
  assert.equal(t.source, "alternate");
  assert.equal(t.ink, "#FFFFFF");
  // Garnet and blue sit within 0.02 of each other in luminance. Separation here
  // is carried by hue, and the flat-gradient guard must not "fix" that.
  assert.ok(Math.abs(relativeLuminance(t.from) - relativeLuminance(t.to)) < 0.045);
});

test("a white kit becomes the club's other colour, and the white is kept as accent", () => {
  const real = theme("ffffff", "00529f");
  assert.equal(real.from, "#00529F", "royal blue, not grey");
  assert.equal(real.accent, "#FFFFFF");
  assert.notEqual(real.ink, real.from);

  // Both colours pale: nothing to stand on, so the category pair carries it.
  const both = theme("ffffff", "fdfdfd", ["#0047FF", "#002299"]);
  assert.equal(both.source, "fallback");
  assert.equal(both.from, "#0047FF");
});

test("a second colour is rejected when it cannot carry the elected ink", () => {
  // Liverpool's teal alternate is far brighter than its red; taking it would
  // flip the receipt to a colour the club is not known by.
  const t = theme("d00027", "00b2a9");
  assert.equal(t.from, "#D00027");
  assert.equal(t.source, "synthesized");
  assert.notEqual(t.to, "#00B2A9");
});

test("a missing alternate still yields a visible ramp", () => {
  const t = theme("ef0107", null);
  assert.equal(t.from, "#EF0107");
  assert.equal(t.source, "synthesized");
  assert.notEqual(t.to, t.from);
  assert.ok(relativeLuminance(t.to) < relativeLuminance(t.from), "partner goes darker");
});

test("the deep stop stays a colour rather than bottoming out at near-black", () => {
  for (const [p, a] of [["00529f", null], ["034694", null], ["d00027", null]]) {
    const t = theme(p, a);
    assert.ok(
      relativeLuminance(t.to) > 0.01,
      `${t.to} is effectively black — the very look this module removes`
    );
  }
});

test("ink flips to dark on light grounds", () => {
  assert.equal(theme("fde100", "000000").ink, "#0E1013", "Dortmund yellow");
  assert.equal(theme("6cabdd", "1c2c5b").ink, "#0E1013", "Man City sky");
  assert.equal(theme("a50044", "004d98").ink, "#FFFFFF", "Barcelona garnet");
});

test("every shipped club and category clears AA after its own solved scrim", () => {
  const clubs = [
    ["Barcelona", "a50044", "004d98"],
    ["Real Madrid", "ffffff", "00529f"],
    ["Arsenal", "ef0107", "023474"],
    ["Bayern", "dc052d", "0066b2"],
    ["Dortmund", "fde100", "000000"],
    ["Liverpool", "d00027", "00b2a9"],
    ["Man City", "6cabdd", "1c2c5b"],
    ["Napoli", "12a0d7", "003c82"],
    ["Inter", "0068a8", "000000"],
    ["Juventus", "000000", "ffffff"],
    ["Chelsea", "034694", null],
    ["Atletico", "cb3524", "262e62"],
  ];
  for (const [name, primary, alternate] of clubs) {
    const t = theme(primary, alternate);
    assert.ok(effective(t) >= 4.5, `${name}: ${effective(t).toFixed(2)}:1 is under AA`);
  }

  const categories = [
    ["Politikë", "#0047FF", "#002299"],
    ["Ekonomi", "#00A651", "#005C2D"],
    ["Botë", "#F59E0B", "#B45309"],
    ["Teknologji", "#7C3AED", "#4C1D95"],
    ["Showbiz", "#E91E8C", "#9D0B60"],
    ["Kulturë", "#F43F5E", "#9F1239"],
  ];
  for (const [name, light, dark] of categories) {
    const t = theme(light, dark, [light, dark]);
    assert.ok(effective(t) >= 4.5, `${name}: ${effective(t).toFixed(2)}:1 is under AA`);
  }
});

test("no usable colour anywhere returns null rather than a guess", () => {
  assert.equal(receiptTheme({}), null);
  assert.equal(receiptTheme({ primary: "nonsense" }), null);
});

test("snapshot — these constants are calibration-sensitive", () => {
  // Any change to the floors, the hue shifts or the flat-gradient guard moves
  // these. That is allowed; re-read the table and confirm each club still reads
  // as itself before updating it.
  assert.deepEqual(
    Object.fromEntries(
      [
        ["barcelona", ["a50044", "004d98"]],
        ["arsenal", ["ef0107", "023474"]],
        ["dortmund", ["fde100", "000000"]],
        ["realMadrid", ["ffffff", "00529f"]],
      ].map(([k, [p, a]]) => {
        const t = theme(p, a);
        return [k, `${t.from}->${t.to}/${t.ink}`];
      })
    ),
    {
      barcelona: "#A50044->#004D98/#FFFFFF",
      arsenal: "#EF0107->#023474/#FFFFFF",
      dortmund: "#FDE100->#CCA100/#0E1013",
      realMadrid: "#00529F->#003E42/#FFFFFF",
    }
  );
});
