// The name a reader's paper carries: "Gazeta e Lindit".
//
// A signed-in reader's first name comes from their account; a guest is asked
// once ("Si të thërras?") and the answer stays on the device. Either way the
// masthead needs it in the genitive, and Albanian declines names by their
// ending:
//
//   Lind → Lindit, Arben → Arbenit      most consonants take -it
//   Erik → Erikut, Burak → Burakut      -k, -g, -h take -ut
//   Ardi → Ardit                        -i takes -t
//   Arta → Artës, Drita → Dritës        -a becomes -ës
//   Shqipe → Shqipes                    -e takes -s
//   Lumë → Lumës                        -ë takes -s
//
// Anything else (-o, -u, -y, a name these rules would get wrong) has no
// genitive here, and the masthead says "Gazeta jote" instead. A wrong ending on
// someone's own name is worse than no name.

export const NAME_KEY = "383:reader-name";

const LETTERS = /^[A-Za-zÇçËëÀ-ÖØ-öø-ÿ'-]{2,24}$/u;

/**
 * A usable first name, or "" — one word, letters only, 2 to 24 long,
 * capitalised. Untrusted input in, something safe to print out.
 */
export function normalizeName(raw) {
  if (typeof raw !== "string") return "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  if (!LETTERS.test(first)) return "";
  return first.charAt(0).toLocaleUpperCase("sq") + first.slice(1).toLocaleLowerCase("sq");
}

/** "Lindit" for "Lind", or null where the ending is not one we are sure of. */
export function genitive(raw) {
  const name = normalizeName(raw);
  if (!name) return null;
  const last = name.slice(-1).toLowerCase();
  if (last === "a") return `${name.slice(0, -1)}ës`;
  if (last === "e" || last === "ë") return `${name}s`;
  if (last === "i") return `${name}t`;
  if (last === "k" || last === "g" || last === "h") return `${name}ut`;
  if (/[bcçdfjlmnpqrstvxz]/.test(last)) return `${name}it`;
  return null;
}

/** "Gazeta e Lindit", or "Gazeta jote" when the name cannot be declined. */
export function paperName(raw) {
  const gen = genitive(raw);
  return gen ? `Gazeta e ${gen}` : "Gazeta jote";
}

function store() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The name this device was given, or "". */
export function readName() {
  try {
    return normalizeName(store()?.getItem(NAME_KEY) ?? "");
  } catch {
    return "";
  }
}

/** Keep `raw` as this device's name; "" or junk clears it. Returns what was kept. */
export function writeName(raw) {
  const name = normalizeName(raw);
  try {
    if (name) store()?.setItem(NAME_KEY, name);
    else store()?.removeItem(NAME_KEY);
  } catch {
    // Not kept; the paper says "Gazeta jote" next time.
  }
  return name;
}
