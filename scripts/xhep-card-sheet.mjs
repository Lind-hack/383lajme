#!/usr/bin/env node
/**
 * Contact sheet for the Kosova në xhep card.
 *
 *   node scripts/xhep-card-sheet.mjs [out.html] [--lang sq] [--scan-test]
 *
 * Renders every fixture visitor's card. With --scan-test the page also
 * rasterizes each card at three display widths and decodes its QR with an
 * independent decoder (jsQR from a CDN, never shipped), writing PASS/FAIL
 * into the page so a headless --dump-dom run can read the results.
 */
import { writeFileSync } from "node:fs";
import { cardArt } from "../lib/xhep/card-art.mjs";
import { FIXTURE_PROFILES } from "../lib/xhep/fixtures/profiles.mjs";

const args = process.argv.slice(2);
const out = args.find((arg) => !arg.startsWith("--")) ?? "xhep-card-sheet.html";
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en";
const scanTest = args.includes("--scan-test");

const TRIP_URL = (id) => `https://383ks.com/visit/t/${id.padEnd(22, "x").slice(0, 22)}`;

const describe = (p) =>
  [p.name ?? "(no name)", p.travellerType, p.arrival, `${p.days}d`, p.interests.join("+"), p.cities.join("→")].join(" · ");

const cards = FIXTURE_PROFILES.map((profile) => {
  const url = TRIP_URL(profile.id);
  return `<figure data-expect="${url}"><div class="card">${cardArt(profile, { seed: profile.id, lang, qrUrl: url })}</div><figcaption>${describe(profile)}<br><span class="scan"></span></figcaption></figure>`;
}).join("");

const scanScript = scanTest
  ? `<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script>
(async () => {
  const results = [];
  for (const fig of document.querySelectorAll("figure")) {
    const svg = fig.querySelector("svg").outerHTML;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const line = [];
    for (const width of [600, 360, 240]) {
      const height = Math.round(width * 1.5);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height);
      const code = jsQR(data.data, width, height);
      const ok = code && code.data === fig.dataset.expect;
      line.push(width + "px:" + (ok ? "PASS" : "FAIL"));
    }
    fig.querySelector(".scan").textContent = line.join(" ");
    results.push(line.join(" "));
  }
  document.body.dataset.scan = results.join(" | ");
})();
</script>`
  : "";

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kosova në xhep — qilim cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=block" rel="stylesheet">
<style>
:root{--ink:#17130E}
body{margin:0;background:#E9E1D3;color:var(--ink);font:500 15px/1.5 Manrope,Arial,sans-serif;padding:40px 32px 80px}
h1{font-size:34px;letter-spacing:-.02em;margin:0 0 6px}
.note{max-width:70ch;margin:0 0 32px;opacity:.75}
.row{display:grid;grid-template-columns:repeat(7,minmax(200px,1fr));gap:20px;overflow-x:auto;padding-bottom:6px}
figure{margin:0}
.card svg{width:100%;height:auto;display:block;border-radius:14px;box-shadow:0 14px 30px rgba(39,29,19,.18)}
figcaption{font-size:11px;font-weight:700;margin-top:10px;opacity:.7;line-height:1.35}
.scan{font-variant-numeric:tabular-nums}
</style></head><body>
<h1>Kosova në xhep — the qilim card, with its woven QR</h1>
<p class="note">Seven synthetic visitors. Every QR is real and points at a sample trip link (https://383ks.com/visit/t/…); scan the screen with your phone camera to test. The trip pages themselves come later (Task 15), so the link itself will 404 for now.</p>
<div class="row">${cards}</div>
${scanScript}
</body></html>`;

writeFileSync(out, html);
console.log(`wrote ${out} (${FIXTURE_PROFILES.length} cards${scanTest ? ", with scan test" : ""})`);
