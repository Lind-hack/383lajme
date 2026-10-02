#!/usr/bin/env node
/**
 * Contact sheet for judging the Kosova në xhep card structures.
 *
 *   node scripts/xhep-card-sheet.mjs [out.html] [--lang sq]
 *
 * Renders every fixture profile in every structure, one row per structure,
 * so structures are compared on identical inputs.
 */
import { writeFileSync } from "node:fs";
import { CARD_STRUCTURES, cardArt } from "../lib/xhep/card-art.mjs";
import { FIXTURE_PROFILES } from "../lib/xhep/fixtures/profiles.mjs";

const args = process.argv.slice(2);
const out = args.find((arg) => !arg.startsWith("--")) ?? "xhep-card-sheet.html";
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en";

const LABELS = {
  ticket: ["Ticket", "A regional bus/rail ticket: colour block by interest, the route through their cities, a tear-off stub."],
  filigree: ["Filigree", "A Prizren filigree medallion: a petal per trip day, a bead ring per city, granules per interest."],
  qilim: ["Qilim", "A Dukagjin kilim: a lozenge per city, interest colours in the weave, a sewn-on label."],
};

const describe = (p) =>
  [p.name ?? "(no name)", p.travellerType, p.arrival, `${p.days}d`, p.interests.join("+"), p.cities.join("→")].join(" · ");

const rows = CARD_STRUCTURES.map((structure) => {
  const cards = FIXTURE_PROFILES.map(
    (profile) => `<figure><div class="card">${cardArt(profile, { structure, seed: profile.id, lang })}</div><figcaption>${describe(profile)}</figcaption></figure>`,
  ).join("");
  return `<section><h2>${LABELS[structure][0]}</h2><p>${LABELS[structure][1]}</p><div class="row">${cards}</div></section>`;
}).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kosova në xhep — card structures</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=block" rel="stylesheet">
<style>
:root{--ink:#17130E;--paper:#F4EBDD}
body{margin:0;background:#E9E1D3;color:var(--ink);font:500 15px/1.5 Manrope,Arial,sans-serif;padding:40px 32px 80px}
h1{font-size:34px;letter-spacing:-.02em;margin:0 0 6px}
.note{max-width:70ch;margin:0 0 36px;opacity:.75}
section{margin:0 0 56px}
h2{font-size:24px;margin:0 0 2px;letter-spacing:-.01em}
section>p{margin:0 0 16px;opacity:.7}
.row{display:grid;grid-template-columns:repeat(7,minmax(200px,1fr));gap:20px;overflow-x:auto;padding-bottom:6px}
figure{margin:0}
.card svg{width:100%;height:auto;display:block;border-radius:14px;box-shadow:0 14px 30px rgba(39,29,19,.18)}
figcaption{font-size:11px;font-weight:700;margin-top:10px;opacity:.65;line-height:1.35}
</style></head><body>
<h1>Kosova në xhep — three card structures</h1>
<p class="note">Same seven synthetic visitors in every row. The QR squares are placeholders with real finder patterns, there only to judge size and placement; the scannable woven QR comes in Task 3. Pick a structure (or a mix), and say what to push.</p>
${rows}
</body></html>`;

writeFileSync(out, html);
console.log(`wrote ${out} (${CARD_STRUCTURES.length} structures × ${FIXTURE_PROFILES.length} profiles)`);
