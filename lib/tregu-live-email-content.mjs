/** Pure, non-secret composition for the one-per-run verified-news repricing email. */
const SITE_ORIGIN = "https://383ks.com";

function asPercentage(probability) {
  return `${(Number(probability) * 100).toFixed(2)}%`;
}

function asSignedPoints(change) {
  const value = Number(change) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} pp`;
}

function marketLink(slug) {
  return `${SITE_ORIGIN}/tregu/${encodeURIComponent(String(slug))}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function sourceLine(source) {
  const label = String(source.label || "Burim i verifikuar");
  const title = String(source.title || source.slug || "Artikull i verifikuar");
  const link = String(source.url || "");
  return link ? `- ${label}: ${title} — ${link}` : `- ${label}: ${title}`;
}

function sourceCard(source) {
  const label = escapeHtml(source.label || "Burim i verifikuar");
  const title = escapeHtml(source.title || source.slug || "Artikull i verifikuar");
  const href = safeHttpUrl(source.url);
  const body = href ? `<a href="${escapeHtml(href)}" style="color:#155eef;text-decoration:none;font-weight:700">${title} ↗</a>` : `<span style="font-weight:700;color:#172033">${title}</span>`;
  return `<li style="margin:0 0 10px;padding:12px 14px;background:#f8fafc;border:1px solid #e6eaf0;border-radius:10px"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:4px">${label}</div>${body}</li>`;
}

/** A clean, readable report; sent only for persisted verified-news probability changes. */
export function hasEvidenceBackedRepriceChanges(result) {
  return Boolean(!result?.skipped && Array.isArray(result?.email_updates) && result.email_updates.length > 0);
}

export function buildTreguRepriceEmail({ runKey, changes }) {
  const lines = [
    "383 Tregu — evidence-backed news market update",
    "This email reports a real probability change applied from verified news evidence; it is not a scan, provider fallback, or no-change notification.",
    `Run: ${runKey}`,
    `Affected markets: ${changes.length}`,
    "",
  ];

  const cards = changes.map((change, index) => {
    const before = asPercentage(change.before_probability);
    const after = asPercentage(change.after_probability);
    const points = asSignedPoints(change.absolute_percentage_point_change);
    const url = marketLink(change.slug);
    lines.push(`${index + 1}. ${String(change.question)}`);
    lines.push(`Market: ${String(change.slug)} — ${url}`);
    lines.push(`Provider: ${String(change.provider || "unknown")}`);
    lines.push(`Affected outcome: PO — ${before} → ${after} (${points})`);
    lines.push(`Timestamp: ${String(change.timestamp)}`);
    lines.push("Verified sources used:");
    for (const source of change.verified_sources ?? []) lines.push(sourceLine(source));
    lines.push("Evidence-backed news update: this market probability change was applied only after the verified sources above were supplied to the AI repricer.", "");
    return `<section role="article" style="margin:0 0 20px;padding:22px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:8px">Ndryshim i verifikuar · ${index + 1}</div>
      <h2 style="margin:0 0 12px;color:#172033;font-size:20px;line-height:1.35">${escapeHtml(change.question)}</h2>
      <a href="${escapeHtml(url)}" style="display:inline-block;margin:0 0 18px;color:#155eef;font-size:14px;font-weight:700;text-decoration:none">Hap tregun në 383 Tregu →</a>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px 18px"><tr>
        <td style="width:33.33%;padding:14px;background:#f8fafc;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#667085;text-transform:uppercase">Para</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#172033">${before}</div></td>
        <td style="width:33.33%;padding:14px;background:#eff8ff;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#1570ef;text-transform:uppercase">Tani</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#175cd3">${after}</div></td>
        <td style="width:33.33%;padding:14px;background:#ecfdf3;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#027a48;text-transform:uppercase">Lëvizja</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#027a48">${points}</div></td>
      </tr></table>
      <div style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475467"><strong style="color:#172033">Furnizuesi AI:</strong> ${escapeHtml(change.provider || "unknown")}<br><strong style="color:#172033">Koha:</strong> ${escapeHtml(change.timestamp)}</div>
      <div style="margin:0 0 8px;font-size:13px;font-weight:800;color:#172033">Burimet e verifikuara</div>
      <ul style="padding:0;margin:0;list-style:none">${(change.verified_sources ?? []).map(sourceCard).join("") || `<li style="color:#667085">Nuk u ruajt asnjë lidhje burimi.</li>`}</ul>
    </section>`;
  }).join("");

  const text = lines.join("\n");
  return {
    subject: `383 Tregu — ${changes.length} evidence-backed market update${changes.length === 1 ? "" : "s"}`,
    text,
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto;padding:28px 16px"><header style="padding:26px 28px;margin-bottom:20px;background:#172033;border-radius:18px;color:#ffffff"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9bd3ff">383 Tregu · Oracle i lajmeve</div><h1 style="margin:10px 0 8px;font-size:28px;line-height:1.2">Përditësim i verifikuar i tregut</h1><p style="margin:0;color:#d0d5dd;font-size:14px;line-height:1.55">U aplikuan ${changes.length} ndryshim${changes.length === 1 ? "" : "e"} vetëm nga burime të verifikuara. Skanimet pa evidencë nuk dërgojnë email.</p></header>${cards}<footer style="padding:4px 12px;color:#667085;font-size:12px;line-height:1.5">Run: ${escapeHtml(runKey)}<br>383 Tregu është një treg virtual me 383C; ky njoftim nuk krijon, ndryshon ose shlyen transaksione të përdoruesve.</footer></main></body></html>`,
  };
}

/** True only for source-state changes that were confirmed persisted by the paired RPC. */
export function hasPersistedMaterialPairedBinaryChange(result) {
  return Boolean(!result?.skipped && Array.isArray(result?.paired_binary_email_updates) && result.paired_binary_email_updates.some((change) => change?.persisted === true && change?.material_change === true));
}

/** F1 messages are emitted only after the database oracle returned a persisted snapshot. */
export function buildF1LiveEmail({ runKey, changes }) {
  const cards = changes.map((change) => `<section style="margin:0 0 16px;padding:20px;background:#fff;border:1px solid #e4e7ec;border-radius:14px"><h2 style="margin:0 0 9px;color:#172033;font-size:19px">${escapeHtml(change.question)}</h2><p style="margin:0 0 10px;color:#475467">${escapeHtml(change.driver_code)} · P${escapeHtml(change.position)} · ${escapeHtml(change.gap)} · ${escapeHtml(change.pits)} pit stop(s)</p><p style="margin:0 0 10px;font-weight:800;color:#172033">PO: ${asPercentage(change.before_probability)} → ${asPercentage(change.after_probability)}</p><a href="${escapeHtml(change.source_url)}" style="color:#155eef;font-weight:700">Formula 1 Dashboard live timing ↗</a></section>`).join("");
  const text = changes.map((change) => `${change.question}\n${change.driver_code} P${change.position}, ${change.gap}, ${change.pits} pit stop(s)\nPO: ${asPercentage(change.before_probability)} → ${asPercentage(change.after_probability)}\nSource: ${change.source_url}`).join("\n\n");
  return { subject: `383 Tregu — Formula 1 live update (${changes.length})`, text: `383 Tregu Formula 1 Dashboard update\nRun: ${runKey}\n\n${text}`, html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto"><header style="padding:24px;background:#172033;border-radius:16px;color:#fff;margin-bottom:18px"><h1 style="margin:0;font-size:25px">Formula 1 live update</h1><p style="margin:9px 0 0;color:#d0d5dd">Persisted, bounded virtual-market movement from Formula 1 Dashboard—not a routine scan.</p></header>${cards}<footer style="color:#667085;font-size:12px">Run: ${escapeHtml(runKey)} · 383 Tregu is virtual; this update does not alter user balances, positions, or transactions.</footer></main></body></html>` };
}

function metricLines(change) {
  const metrics = change?.state?.metrics ?? {};
  const sources = change?.state?.metric_sources ?? {};
  const labels = { shots: "Shots", shots_on_target: "Shots on target", possession: "Possession", xg: "xG", corners: "Corners" };
  return Object.entries(metrics).flatMap(([team, values]) => Object.entries(values ?? {}).map(([key, value]) => ({ team, key, label: labels[key] ?? key, value, source: sources?.[team]?.[key] === "flashscore" ? "Flashscore" : "ESPN" })));
}

/** Factual Argentina–Spain report. ESPN is authoritative for score/status; Flashscore is labeled only for supplemental metrics. */
export function buildArgentinaSpainLiveEmail({ runKey, changes }) {
  const lines = [
    "383 Tregu — Argentina–Spain live update",
    "This notification was sent only after a material score/stat state change was successfully persisted to both paired binary markets.",
    `Run: ${runKey}`,
    "",
  ];
  const cards = changes.map((change, index) => {
    const state = change.state ?? {};
    const teams = Array.isArray(state.competitors) ? state.competitors : [];
    const argentina = teams.find((team) => String(team?.team).toLowerCase() === "argentina") ?? {};
    const spain = teams.find((team) => String(team?.team).toLowerCase() === "spain") ?? {};
    const score = `Argentina ${argentina.score ?? "—"}–${spain.score ?? "—"} Spain`;
    const stats = metricLines(change);
    const espnUrl = safeHttpUrl(state.source_url);
    const flashscoreUrl = safeHttpUrl(state?.supplemental?.flashscore?.source_url);
    lines.push(`${index + 1}. ESPN official score source: ${score} (${state.detail || state.status || "live"})`);
    if (espnUrl) lines.push(`ESPN: ${espnUrl}`);
    for (const stat of stats) lines.push(`${stat.team} — ${stat.label}: ${stat.value} (${stat.source})`);
    if (flashscoreUrl) lines.push(`Flashscore supplemental live metric source: ${flashscoreUrl}`);
    lines.push(`Persisted at: ${change.timestamp}`, "");
    const statHtml = stats.length ? `<ul style="margin:0;padding-left:18px">${stats.map((stat) => `<li>${escapeHtml(stat.team)} — ${escapeHtml(stat.label)}: ${escapeHtml(stat.value)} <span style="color:#667085">(${escapeHtml(stat.source)})</span></li>`).join("")}</ul>` : `<p style="margin:0;color:#667085">No live statistics were supplied in this persisted state.</p>`;
    return `<section role="article" style="margin:0 0 18px;padding:22px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px"><h2 style="margin:0 0 10px;color:#172033;font-size:20px">Argentina–Spain</h2><p style="margin:0 0 12px"><strong>ESPN official score source:</strong> ${escapeHtml(score)} (${escapeHtml(state.detail || state.status || "live")})</p>${espnUrl ? `<p style="margin:0 0 14px"><a href="${escapeHtml(espnUrl)}" style="color:#155eef">ESPN match summary ↗</a></p>` : ""}<div style="margin:0 0 12px;font-weight:800">Persisted live statistics</div>${statHtml}${flashscoreUrl ? `<p style="margin:14px 0 0"><strong>Flashscore supplemental live metric source:</strong> <a href="${escapeHtml(flashscoreUrl)}" style="color:#155eef">Flashscore ↗</a></p>` : ""}<p style="margin:14px 0 0;color:#667085;font-size:12px">Persisted at: ${escapeHtml(change.timestamp)}</p></section>`;
  }).join("");
  return {
    subject: `383 Tregu — Argentina–Spain live update (${changes.length})`,
    text: lines.join("\n"),
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto;padding:28px 16px"><header style="padding:26px 28px;margin-bottom:20px;background:#172033;border-radius:18px;color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9bd3ff">383 Tregu · Live sport</div><h1 style="margin:10px 0 8px;font-size:28px">Argentina–Spain update</h1><p style="margin:0;color:#d0d5dd;font-size:14px;line-height:1.55">Factual source state only. ESPN is the official score/status source; Flashscore, when shown, is supplemental for live metrics.</p></header>${cards}<footer style="padding:4px 12px;color:#667085;font-size:12px;line-height:1.5">Run: ${escapeHtml(runKey)}<br>This notification follows a successful paired-binary persistence and does not change user balances, positions, or transactions.</footer></main></body></html>`,
  };
}
