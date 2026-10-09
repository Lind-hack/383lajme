// Albanian alphabetical order, the same on every machine.
//
// String.prototype.localeCompare(…, "sq") depends on the ICU data of whatever
// runs it, and the server (Node on Railway) and the reader's browser disagree:
// one files "Greqi" before "Gjermani", the other after. A list sorted that way
// in a client component renders in one order on the server and another while
// hydrating, which React reports as a text mismatch (#418) on /bota-per-kosoven.
// This compares by the 36-letter alphabet itself — digraphs (dh, gj, ll, nj,
// rr, sh, th, xh, zh) are letters of their own — so both sides agree.

const ALPHABET = ["a", "b", "c", "ç", "d", "dh", "e", "ë", "f", "g", "gj", "h", "i", "j", "k", "l", "ll", "m", "n", "nj", "o", "p", "q", "r", "rr", "s", "sh", "t", "th", "u", "v", "x", "xh", "y", "z", "zh"];
const RANK = new Map(ALPHABET.map((letter, i) => [letter, i]));
const OFFSET = ALPHABET.length;

/** The word as alphabet positions; anything else (spaces, digits, other scripts) after the letters. */
function key(word) {
  const s = String(word ?? "").toLowerCase();
  const out = [];
  for (let i = 0; i < s.length; ) {
    const two = s.slice(i, i + 2);
    if (two.length === 2 && RANK.has(two)) {
      out.push(RANK.get(two));
      i += 2;
    } else {
      const ch = s[i];
      out.push(RANK.has(ch) ? RANK.get(ch) : OFFSET + ch.codePointAt(0));
      i += 1;
    }
  }
  return out;
}

/** Comparator for Array.prototype.sort, in Albanian alphabetical order. */
export function sqCompare(a, b) {
  const x = key(a);
  const y = key(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
}
