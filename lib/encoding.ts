// Safety net against UTF-8-read-as-cp1252 mojibake ("për" → "pÃ«r").
// Any text source (SQLite, auto-article JSON, mock data) that was ever
// round-tripped through the wrong codec gets repaired at read time.

const SIGNATURE = /Ã|â€|ðŸ/;

// cp1252 specials in 0x80–0x9F — everything else maps 1:1 to latin-1.
const CP1252_HIGH: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84,
  "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
  "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

export function fixMojibake(s: string): string {
  if (!SIGNATURE.test(s)) return s;

  const bytes: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_HIGH[ch] !== undefined) {
      bytes.push(CP1252_HIGH[ch]);
    } else {
      // Character can't have come from a cp1252 misread — not mojibake.
      return s;
    }
  }

  const decoded = Buffer.from(bytes).toString("utf8");
  // U+FFFD means the byte stream wasn't valid UTF-8 → keep the original.
  if (decoded.includes("�")) return s;
  return decoded;
}
