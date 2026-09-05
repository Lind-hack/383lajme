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

function logoImage(url, alt) {
  const href = safeHttpUrl(url);
  return href ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}" width="32" height="32" style="display:block;width:32px;height:32px;object-fit:contain;border-radius:8px;background:#ffffff;padding:3px">` : "";
}

/** The driver's own face. A constructor badge names the car, not who is in it. */
function driverFace(url, alt, teamColour) {
  const href = safeHttpUrl(url);
  const ring = /^#[0-9a-f]{6}$/i.test(String(teamColour ?? "")) ? teamColour : "#d0d5dd";
  return href
    ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:cover;object-position:center top;border-radius:100px;background:#f3f5f8;border:2px solid ${escapeHtml(ring)}">`
    : "";
}

function graphRows(graph) {
  const rows = Array.isArray(graph?.points) ? [{ label: "Market probability", color: "#155eef", points: graph.points }] : [];
  for (const [key, points] of Object.entries(graph?.series ?? {})) {
    if (!Array.isArray(points)) continue;
    rows.push({ label: String(key), color: ["#155eef", "#12b76a", "#f79009", "#d92d20"][rows.length % 4], points });
  }
  return rows.map((row) => ({ ...row, points: row.points.map((point) => ({ timestamp: String(point?.timestamp ?? ""), probability: Number(point?.probability), kind: point?.kind })).filter((point) => point.timestamp && Number.isFinite(point.probability) && point.probability >= 0 && point.probability <= 1).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) })).filter((row) => row.points.length);
}

function graphSvg(graph, labels = {}) {
  const rows = graphRows(graph).slice(0, 4);
  if (!rows.length) return `<div style="padding:14px 16px;border:1px solid #e4e7ec;border-radius:12px;color:#667085;font-size:12px">No persisted graph points were available for this update.</div>`;
  const width = 640; const height = 190; const padX = 34; const padY = 22;
  const all = rows.flatMap((row) => row.points.map((point) => point.probability));
  const min = Math.max(0, Math.min(...all) - 0.04); const max = Math.min(1, Math.max(...all) + 0.04);
  const span = Math.max(0.04, max - min);
  const longest = Math.max(...rows.map((row) => row.points.length));
  const coords = (row) => row.points.map((point, index) => `${(longest <= 1 ? width / 2 : padX + (index / (longest - 1)) * (width - padX * 2)).toFixed(1)},${(height - padY - ((point.probability - min) / span) * (height - padY * 2)).toFixed(1)}`).join(" ");
  const lines = [0, 0.5, 1].map((fraction) => {
    const y = height - padY - fraction * (height - padY * 2); const value = min + fraction * span;
    return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${width - padX}" y2="${y.toFixed(1)}" stroke="#e4e7ec" stroke-width="1"/><text x="2" y="${(y + 4).toFixed(1)}" fill="#667085" font-size="11">${(value * 100).toFixed(0)}%</text>`;
  }).join("");
  const polylines = rows.map((row) => `<polyline fill="none" stroke="${row.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${coords(row)}"/>${row.points.length === 1 ? `<circle cx="${(width / 2).toFixed(1)}" cy="${(height - padY - ((row.points[0].probability - min) / span) * (height - padY * 2)).toFixed(1)}" r="5" fill="${row.color}"/>` : ""}`).join("");
  const legend = rows.map((row) => `<span style="display:inline-flex;align-items:center;margin:0 12px 6px 0;font-size:11px;color:#475467"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${row.color};margin-right:5px"></span>${escapeHtml(labels[row.label] || row.label)}</span>`).join("");
  const newest = rows.flatMap((row) => row.points).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const note = longest < 2 ? "One persisted point only. No line has been inferred." : `Exact persisted points through ${newest?.timestamp ?? "the latest snapshot"}.`;
  return `<div style="margin:14px 0 16px;padding:14px 14px 10px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:12px"><div style="font-size:12px;font-weight:800;color:#172033;margin-bottom:8px">Persisted probability graph</div><svg role="img" aria-label="${escapeHtml(note)}" viewBox="0 0 ${width} ${height}" width="100%" height="190" style="display:block;background:#ffffff;border-radius:8px">${lines}${polylines}</svg><div style="margin-top:8px">${legend}</div><div style="font-size:11px;color:#667085">${escapeHtml(note)}</div></div>`;
}

function competitorCards(state = {}) {
  const competitors = Array.isArray(state.competitors) ? state.competitors.filter((team) => String(team?.team ?? "").trim()) : [];
  if (!competitors.length) return "";
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px">${competitors.map((team) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e4e7ec;border-radius:10px">${logoImage(team.logo, team.team)}<span style="font-size:13px;font-weight:800;color:#172033">${escapeHtml(team.team)}</span></div>`).join("")}</div>`;
}

function outcomeDisplayName(key, state = {}) {
  const outcome = (Array.isArray(state.sport_outcomes) ? state.sport_outcomes : []).find((item) => String(item?.key ?? "").toLowerCase() === String(key).toLowerCase());
  // The outcome's own label comes first. Reading team before label meant every
  // F1 driver was named after their constructor, so both Mercedes cars arrived
  // in the inbox as "Mercedes" and the reader could not tell which was which.
  // Football keeps working because its labels are home/away/draw, which are
  // still refused here and fall through to the club name below.
  if (outcome?.label && !/^(home|away|draw)$/i.test(String(outcome.label))) return String(outcome.label);
  if (outcome?.team) return String(outcome.team);
  const competitor = (Array.isArray(state.competitors) ? state.competitors : []).find((item) => String(item?.homeAway ?? "").toLowerCase() === String(key).toLowerCase() || String(item?.team ?? "").toLowerCase() === String(key).toLowerCase());
  return String(competitor?.team ?? outcome?.label ?? key);
}


function sourceLine(source) {
  const label = String(source.label || "Burim i verifikuar");
  const title = String(source.title || source.slug || "Artikull i verifikuar");
  const link = String(source.url || "");
  const published = source.published_at ? ` [published ${source.published_at}]` : "";
  return link ? `- ${label}: ${title}${published} - ${link}` : `- ${label}: ${title}${published}`;
}

function sourceCard(source) {
  const label = escapeHtml(source.label || "Burim i verifikuar");
  const title = escapeHtml(source.title || source.slug || "Artikull i verifikuar");
  const href = safeHttpUrl(source.url);
  const published = source.published_at ? `<div style="font-size:11px;color:#667085;margin-top:5px">Published: ${escapeHtml(source.published_at)}</div>` : "";
  const body = href ? `<a href="${escapeHtml(href)}" style="color:#155eef;text-decoration:none;font-weight:700">${title} ↗</a>` : `<span style="font-weight:700;color:#172033">${title}</span>`;
  return `<li style="margin:0 0 10px;padding:12px 14px;background:#f8fafc;border:1px solid #e6eaf0;border-radius:10px"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:4px">${label}</div>${body}${published}</li>`;
}

/** A clean, readable report; sent only for persisted news-or-deadline market changes. */
export function hasEvidenceBackedRepriceChanges(result) {
  return Boolean(!result?.skipped && Array.isArray(result?.email_updates) && result.email_updates.length > 0);
}

export function buildTreguRepriceEmail({ runKey, changes }) {
  const lines = [
    "383 Tregu — persisted market update",
    "This email reports a real verified-news or deadline-oracle probability/state change; it is not a scan, provider fallback, or no-change notification.",
    "Evidence window: current time through the previous 14 days; reused evidence is excluded.",
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
    if (change.reason) lines.push(`Reason: ${String(change.reason)}`);
    if (change.remaining_hours !== null && change.remaining_hours !== undefined) lines.push(`Hours remaining: ${Number(change.remaining_hours).toFixed(2)}`);
    if (change.evidence_fingerprint) lines.push(`Evidence fingerprint: ${String(change.evidence_fingerprint)}`);
    lines.push(`Affected outcome: PO - ${before} -> ${after} (${points})`);
    if (change.before_state || change.after_state) lines.push(`State: ${String(change.before_state?.status ?? "unknown")}/${String(change.before_state?.outcome ?? "—")} → ${String(change.after_state?.status ?? "unknown")}/${String(change.after_state?.outcome ?? "—")}`);
    lines.push(`Timestamp: ${String(change.timestamp)}`);
    lines.push("Verified sources used:");
    for (const source of change.verified_sources ?? []) lines.push(sourceLine(source));
    lines.push(change.reason ? "Deadline-oracle update: this change was confirmed by the persisted deadline RPC." : "Evidence-backed news update: this market probability change was applied only after the verified sources above were supplied to the AI repricer.", "");
    return `<section role="article" style="margin:0 0 20px;padding:22px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:8px">Ndryshim i verifikuar · ${index + 1}</div>
      <h2 style="margin:0 0 12px;color:#172033;font-size:20px;line-height:1.35">${escapeHtml(change.question)}</h2>
      <a href="${escapeHtml(url)}" style="display:inline-block;margin:0 0 18px;color:#155eef;font-size:14px;font-weight:700;text-decoration:none">Hap tregun në 383 Tregu →</a>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px 18px"><tr>
        <td style="width:33.33%;padding:14px;background:#f8fafc;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#667085;text-transform:uppercase">Para</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#172033">${before}</div></td>
        <td style="width:33.33%;padding:14px;background:#eff8ff;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#1570ef;text-transform:uppercase">Tani</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#175cd3">${after}</div></td>
        <td style="width:33.33%;padding:14px;background:#ecfdf3;border-radius:10px"><div style="font-size:11px;font-weight:800;color:#027a48;text-transform:uppercase">Lëvizja</div><div style="margin-top:5px;font-size:22px;font-weight:800;color:#027a48">${points}</div></td>
      </tr></table>
      <div style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#475467"><strong style="color:#172033">Furnizuesi:</strong> ${escapeHtml(change.provider || "unknown")}${change.reason ? `<br><strong style="color:#172033">Arsyeja:</strong> ${escapeHtml(change.reason)}` : ""}${change.remaining_hours !== null && change.remaining_hours !== undefined ? `<br><strong style="color:#172033">Orë të mbetura:</strong> ${Number(change.remaining_hours).toFixed(2)}` : ""}${change.evidence_fingerprint ? `<br><strong style="color:#172033">Evidence fingerprint:</strong> ${escapeHtml(change.evidence_fingerprint)}` : ""}${change.before_state || change.after_state ? `<br><strong style="color:#172033">Gjendja:</strong> ${escapeHtml(change.before_state?.status ?? "unknown")}/${escapeHtml(change.before_state?.outcome ?? "-")} -> ${escapeHtml(change.after_state?.status ?? "unknown")}/${escapeHtml(change.after_state?.outcome ?? "-")}` : ""}<br><strong style="color:#172033">Koha:</strong> ${escapeHtml(change.timestamp)}</div>
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
  const lines = [
    "383 Tregu - Formula 1 live update",
    "This notification reports a persisted, bounded virtual-market movement from Formula 1 Dashboard.",
    `Run: ${runKey}`,
    "",
  ];
  const cards = changes.map((change) => {
    const driver = String(change.driver_name || change.driver_code || "Driver");
    const team = String(change.team_name || "Team not supplied");
    const before = asPercentage(change.before_probability);
    const after = asPercentage(change.after_probability);
    const live = Number.isFinite(Number(change.position));
    const detail = live
      ? `P${change.position} · ${change.gap} · ${change.pits} pit stop(s)`
      : String(change.note || "Pre-race price");
    lines.push(`${driver} - ${team}\n${detail}\nProbability: ${before} -> ${after}\nSource: ${change.source_url}`, "");
    return `<section role="article" style="margin:0 0 16px;padding:20px;background:#fff;border:1px solid #e4e7ec;border-radius:14px"><div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">${driverFace(change.headshot_url, driver, change.team_colour) || logoImage(change.team_logo_url, team)}<div><h2 style="margin:0;color:#172033;font-size:19px">${escapeHtml(driver)}</h2><div style="color:#475467;font-size:13px;font-weight:700">${escapeHtml(team)} · ${escapeHtml(change.driver_code)}</div></div></div><p style="margin:0 0 10px;color:#475467">${escapeHtml(detail)}</p><p style="margin:0 0 10px;font-weight:800;color:#172033">${before} → ${after}</p>${graphSvg(change.graph, { "Market probability": `${driver} probability` })}<a href="${escapeHtml(marketLink(change.slug || ""))}" style="color:#155eef;font-weight:700;text-decoration:none">Open market in 383 Tregu →</a><div style="margin-top:10px"><a href="${escapeHtml(change.source_url)}" style="color:#155eef;font-weight:700">${live ? "Formula 1 Dashboard live timing" : "Burimi"} ↗</a></div></section>`;
  }).join("");
  return { subject: `383 Tregu - Formula 1 live update (${changes.length})`, text: `383 Tregu Formula 1 Dashboard update\n${lines.join("\n")}`, html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto"><header style="padding:24px;background:#172033;border-radius:16px;color:#fff;margin-bottom:18px"><h1 style="margin:0;font-size:25px">Formula 1 live update</h1><p style="margin:9px 0 0;color:#d0d5dd">Actual driver and constructor identity, exact persisted odds history, and Formula 1 Dashboard evidence.</p></header>${cards}<footer style="color:#667085;font-size:12px">Run: ${escapeHtml(runKey)}<br>383 Tregu is virtual. This update does not alter user balances, positions, or transactions.</footer></main></body></html>` };
}

/** Generic official-feed report for persisted football/F1 state, odds, lock, or settlement changes. */
/**
 * A field of drivers, one per row.
 *
 * The generic renderer joins every outcome into a single sentence, which for a
 * twenty-two driver race market is an unreadable paragraph of percentages with
 * no faces and no ordering. A race is a ranked field and should arrive looking
 * like one: rank, portrait, name, constructor, and what the price did.
 */
function outcomeRowsTable(state = {}, before = {}) {
  const outcomes = Array.isArray(state.sport_outcomes) ? state.sport_outcomes : [];
  const probabilities = state.reference_probabilities && typeof state.reference_probabilities === "object" ? state.reference_probabilities : null;
  if (!probabilities || outcomes.length < 6) return "";
  const previous = before?.reference_probabilities && typeof before.reference_probabilities === "object" ? before.reference_probabilities : {};

  const rows = Object.entries(probabilities)
    .map(([key, value]) => {
      const outcome = outcomes.find((item) => String(item?.key ?? "").toLowerCase() === String(key).toLowerCase()) ?? {};
      return {
        key,
        name: String(outcome.label ?? key),
        team: String(outcome.team ?? ""),
        colour: /^#?[0-9a-f]{6}$/i.test(String(outcome.team_colour ?? "")) ? "#" + String(outcome.team_colour).replace(/^#/, "") : "#d0d5dd",
        face: safeHttpUrl(outcome.headshot_url),
        now: Number(value),
        was: Number(previous[key] ?? NaN),
      };
    })
    .sort((a, b) => b.now - a.now);

  const body = rows.map((row, index) => {
    const moved = Number.isFinite(row.was) ? (row.now - row.was) * 100 : null;
    const delta = moved === null || Math.abs(moved) < 0.05
      ? ""
      : `<span style="color:${moved > 0 ? "#087443" : "#b42318"};font-weight:700;font-size:12px">${moved > 0 ? "+" : ""}${moved.toFixed(1)}</span>`;
    const face = row.face
      ? `<img src="${escapeHtml(row.face)}" alt="" width="34" height="34" style="display:block;width:34px;height:34px;border-radius:100px;object-fit:cover;object-position:center top;border:2px solid ${escapeHtml(row.colour)};background:#f3f5f8">`
      : `<div style="width:34px;height:34px;border-radius:100px;border:2px solid ${escapeHtml(row.colour)};background:#f3f5f8"></div>`;
    return `<tr>
      <td style="padding:7px 6px 7px 0;color:#98a2b3;font-size:12px;font-weight:700;width:20px">${index + 1}</td>
      <td style="padding:7px 10px 7px 0;width:34px">${face}</td>
      <td style="padding:7px 0"><div style="font-weight:700;color:#172033;font-size:14px">${escapeHtml(row.name)}</div>${row.team ? `<div style="color:#667085;font-size:12px">${escapeHtml(row.team)}</div>` : ""}</td>
      <td style="padding:7px 0 7px 10px;text-align:right;white-space:nowrap"><span style="font-weight:800;font-size:15px;color:#172033">${(row.now * 100).toFixed(1)}%</span> ${delta}</td>
    </tr>`;
  }).join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px">${body}</table>`;
}

/** The same ranked field, one driver per line, for the plain-text part. */
function outcomeTextLines(state = {}, before = {}) {
  const outcomes = Array.isArray(state.sport_outcomes) ? state.sport_outcomes : [];
  const probabilities = state.reference_probabilities ?? {};
  const previous = before?.reference_probabilities ?? {};
  const rows = Object.entries(probabilities)
    .map(([key, value]) => {
      const outcome = outcomes.find((item) => String(item?.key ?? "").toLowerCase() === String(key).toLowerCase()) ?? {};
      const was = Number(previous[key] ?? NaN);
      const moved = Number.isFinite(was) ? (Number(value) - was) * 100 : null;
      return { name: String(outcome.label ?? key), team: String(outcome.team ?? ""), now: Number(value), moved };
    })
    .sort((a, b) => b.now - a.now);
  return rows
    .map((row, index) => {
      const delta = row.moved === null || Math.abs(row.moved) < 0.05 ? "" : ` (${row.moved > 0 ? "+" : ""}${row.moved.toFixed(1)})`;
      return `${String(index + 1).padStart(2)}. ${row.name}${row.team ? " - " + row.team : ""}: ${(row.now * 100).toFixed(1)}%${delta}`;
    })
    .join("\n");
}

/**
 * Qualifying is the one moment the race book is entitled to move hard.
 *
 * The grid carries the heaviest weight in the opening model — 1.00, against
 * 0.95 for the championship and 0.45 for practice pace — and it is worth about
 * 135x from pole to the back row. So the session that sets it deserves its own
 * report rather than another "official market update": every confirmed
 * position, and what each one did to that driver's price.
 *
 * Ordered by the grid, not by price, because the grid is the news here.
 */
export function buildF1QualifyingEmail({ runKey, question, slug, rows, sourceUrl, provisional = false }) {
  const ordered = [...(rows ?? [])].sort((a, b) => Number(a.grid ?? 99) - Number(b.grid ?? 99));
  const heading = provisional ? "Kualifikimi — rezultate paraprake" : "Kualifikimi — rrjeti zyrtar";

  const body = ordered.map((row) => {
    const moved = Number.isFinite(Number(row.before)) ? (Number(row.after) - Number(row.before)) * 100 : null;
    const delta = moved === null || Math.abs(moved) < 0.05
      ? ""
      : `<span style="color:${moved > 0 ? "#087443" : "#b42318"};font-weight:700;font-size:12px"> ${moved > 0 ? "+" : ""}${moved.toFixed(1)}</span>`;
    const colour = /^#?[0-9a-f]{6}$/i.test(String(row.colour ?? "")) ? "#" + String(row.colour).replace(/^#/, "") : "#d0d5dd";
    const face = safeHttpUrl(row.face)
      ? `<img src="${escapeHtml(safeHttpUrl(row.face))}" alt="" width="34" height="34" style="display:block;width:34px;height:34px;border-radius:100px;object-fit:cover;object-position:center top;border:2px solid ${escapeHtml(colour)};background:#f3f5f8">`
      : `<div style="width:34px;height:34px;border-radius:100px;border:2px solid ${escapeHtml(colour)};background:#f3f5f8"></div>`;
    const penalty = row.penalty ? `<div style="color:#b42318;font-size:12px;font-weight:700">${escapeHtml(row.penalty)}</div>` : "";
    return `<tr>
      <td style="padding:8px 8px 8px 0;width:34px"><div style="width:26px;height:26px;border-radius:7px;background:#172033;color:#fff;font-weight:800;font-size:13px;text-align:center;line-height:26px">${escapeHtml(String(row.grid ?? "-"))}</div></td>
      <td style="padding:8px 10px 8px 0;width:34px">${face}</td>
      <td style="padding:8px 0"><div style="font-weight:700;color:#172033;font-size:14px">${escapeHtml(String(row.name ?? row.key ?? ""))}</div><div style="color:#667085;font-size:12px">${escapeHtml(String(row.team ?? ""))}</div>${penalty}</td>
      <td style="padding:8px 0 8px 10px;text-align:right;white-space:nowrap"><span style="font-weight:800;font-size:15px;color:#172033">${(Number(row.after) * 100).toFixed(1)}%</span>${delta}${Number.isFinite(Number(row.before)) ? `<div style="color:#98a2b3;font-size:11px">nga ${(Number(row.before) * 100).toFixed(1)}%</div>` : ""}</td>
    </tr>`;
  }).join("");

  const text = ordered.map((row) => {
    const moved = Number.isFinite(Number(row.before)) ? (Number(row.after) - Number(row.before)) * 100 : null;
    const delta = moved === null || Math.abs(moved) < 0.05 ? "" : ` (${moved > 0 ? "+" : ""}${moved.toFixed(1)})`;
    return `P${String(row.grid ?? "-").padStart(2)} ${String(row.name ?? row.key ?? "").padEnd(20)} ${String(row.team ?? "").padEnd(16)} ${(Number(row.after) * 100).toFixed(1)}%${delta}${row.penalty ? " - " + row.penalty : ""}`;
  }).join("\n");

  return {
    subject: `383 Tregu — ${provisional ? "kualifikimi ne vazhdim" : "rrjeti i nisjes"}: ${question}`,
    text: `${heading}\n${question}\nRun: ${runKey}\n\n${text}\n\nTregu: ${marketLink(slug)}\nBurimi: ${sourceUrl ?? "not supplied"}`,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto"><header style="padding:24px;background:#172033;border-radius:16px;color:#fff;margin-bottom:18px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#ff8a7a">FORMULA 1 · ${provisional ? "KUALIFIKIMI NE VAZHDIM" : "RRJETI ZYRTAR"}</div><h1 style="margin:8px 0 0;font-size:25px">${escapeHtml(question)}</h1><p style="margin:9px 0 0;color:#d0d5dd">Cdo pozite e konfirmuar, dhe sa e levizi ajo gjasen e secilit pilot.</p></header><section style="padding:20px;background:#fff;border:1px solid #e4e7ec;border-radius:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${body}</table><div style="margin-top:16px"><a href="${escapeHtml(marketLink(slug))}" style="color:#155eef;font-weight:800;text-decoration:none">Hap tregun ne 383 Tregu →</a></div></section><footer style="color:#667085;font-size:12px;margin-top:14px">Run: ${escapeHtml(runKey)}<br>Burimi: ${escapeHtml(sourceUrl ?? "not supplied")}<br>383 Tregu eshte virtual.</footer></main></body></html>`,
  };
}

export function buildOfficialMarketUpdateEmail({ runKey, changes }) {
  const summary = (state = {}) => {
    const teams = Array.isArray(state.competitors) ? state.competitors : [];
    // A race has no score line. Printing "No score supplied" on every F1 card
    // was noise dressed as information.
    const score = teams.length ? teams.map((team) => `${team.team ?? "Team"} ${team.score ?? "-"}`).join(" / ") : null;
    const status = state.detail || state.status || "Official state update";
    const probabilities = state.reference_probabilities && typeof state.reference_probabilities === "object"
      ? Object.entries(state.reference_probabilities).map(([name, value]) => `${outcomeDisplayName(name, state)}: ${(Number(value) * 100).toFixed(1)}%`).join(" · ") : null;
    return { score, status, probabilities, teams };
  };
  const cards = changes.map((change, index) => {
    const url = marketLink(change.slug); const source = safeHttpUrl(change.source_url);
    const before = summary(change.before); const after = summary(change.after);
    const closed = change.after?.status === "closed" || change.after?.status === "resolved";
    const result = change.after?.outcome ? `Result: ${String(change.after.outcome).toUpperCase()}` : null;
    const labels = Object.fromEntries(Object.keys(after.reference_probabilities ?? {}).map((key) => [key, outcomeDisplayName(key, change.after)]));
    return `<section role="article" style="margin:0 0 18px;padding:22px;background:#fff;border:1px solid #e4e7ec;border-radius:16px"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${closed ? "#087443" : "#155eef"};margin-bottom:8px">${closed ? "Official final update" : "Official live update"} · ${index + 1}</div><h2 style="margin:0 0 10px;color:#172033;font-size:20px">${escapeHtml(change.question)}</h2>${competitorCards(change.after)}${after.teams.length || result ? `<div style="padding:14px 16px;background:#f7f9fc;border-radius:12px;margin:0 0 12px"><div style="font-size:12px;color:#667085;font-weight:800;letter-spacing:.06em">WHAT HAPPENED</div>${after.teams.length ? `<div style="font-size:18px;font-weight:800;margin-top:5px">${escapeHtml(after.score)}</div>` : ""}<div style="color:#475467;margin-top:3px">${escapeHtml(after.status)}</div>${result ? `<div style="color:#087443;font-weight:800;margin-top:7px">${escapeHtml(result)}</div>` : ""}</div>` : ""}${outcomeRowsTable(change.after, change.before) || (after.probabilities ? `<div style="margin:0 0 12px;padding:12px 14px;border-left:4px solid #155eef;background:#eff5ff"><strong>Updated odds</strong><br>${escapeHtml(after.probabilities)}</div>` : "")}${graphSvg(change.after?.graph ?? change.before?.graph, labels)}<div style="font-size:13px;color:#667085;line-height:1.5">${before.score ? "Previous state: " + escapeHtml(before.score) + " - " : "Previous: "}${escapeHtml(before.status)}<br>Persisted: ${escapeHtml(change.timestamp)}</div><div style="margin-top:15px"><a href="${escapeHtml(url)}" style="color:#155eef;font-weight:800;text-decoration:none">Open market in 383 Tregu →</a>${source ? ` <span style="color:#98a2b3">·</span> <a href="${escapeHtml(source)}" style="color:#155eef;font-weight:700">Official source ↗</a>` : ""}</div></section>`;
  }).join("");
  const text = changes.map((change, index) => { const before=summary(change.before), after=summary(change.after); return `${index + 1}. ${change.question}\n${after.score ? "What happened: " + after.score + " - " : "Status: "}${after.status}${change.after?.outcome ? ` - result ${String(change.after.outcome).toUpperCase()}` : ""}${after.probabilities ? "\n" + outcomeTextLines(change.after, change.before) : ""}\n${before.score ? "Previous: " + before.score + " - " : "Previous status: "}${before.status}\nMarket: ${marketLink(change.slug)}\nOfficial source: ${change.source_url ?? "not supplied"}`; }).join("\n\n");
  return { subject: `383 Tregu - official market update (${changes.length})`, text: `383 Tregu official market update\nRun: ${runKey}\n\n${text}`, html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto"><header style="padding:24px;background:#172033;border-radius:16px;color:#fff;margin-bottom:18px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#9bd3ff">383 TREGU · VERIFIED CHANGE</div><h1 style="margin:8px 0 0;font-size:25px">Official market update</h1><p style="margin:9px 0 0;color:#d0d5dd">Actual team identities, provider-supplied logos, exact persisted graph points, and official state.</p></header>${cards}<footer style="color:#667085;font-size:12px">Run: ${escapeHtml(runKey)}<br>383 Tregu is virtual. This update does not alter user balances, positions, or transactions.</footer></main></body></html>` };
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
    return `<section role="article" style="margin:0 0 18px;padding:22px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px"><h2 style="margin:0 0 10px;color:#172033;font-size:20px">Argentina–Spain</h2>${competitorCards(state)}<p style="margin:0 0 12px"><strong>ESPN official score source:</strong> ${escapeHtml(score)} (${escapeHtml(state.detail || state.status || "live")})</p>${espnUrl ? `<p style="margin:0 0 14px"><a href="${escapeHtml(espnUrl)}" style="color:#155eef">ESPN match summary ↗</a></p>` : ""}<div style="margin:0 0 12px;font-weight:800">Persisted live statistics</div>${statHtml}${graphSvg(state.graph, { "Market probability": "Argentina / Spain market probability" })}${flashscoreUrl ? `<p style="margin:14px 0 0"><strong>Flashscore supplemental live metric source:</strong> <a href="${escapeHtml(flashscoreUrl)}" style="color:#155eef">Flashscore ↗</a></p>` : ""}<p style="margin:14px 0 0;color:#667085;font-size:12px">Persisted at: ${escapeHtml(change.timestamp)}</p></section>`;
  }).join("");
  return {
    subject: `383 Tregu — Argentina–Spain live update (${changes.length})`,
    text: lines.join("\n"),
    html: `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033"><main style="max-width:720px;margin:0 auto;padding:28px 16px"><header style="padding:26px 28px;margin-bottom:20px;background:#172033;border-radius:18px;color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9bd3ff">383 Tregu · Live sport</div><h1 style="margin:10px 0 8px;font-size:28px">Argentina–Spain update</h1><p style="margin:0;color:#d0d5dd;font-size:14px;line-height:1.55">Factual source state only. ESPN is the official score/status source; Flashscore, when shown, is supplemental for live metrics.</p></header>${cards}<footer style="padding:4px 12px;color:#667085;font-size:12px;line-height:1.5">Run: ${escapeHtml(runKey)}<br>This notification follows a successful paired-binary persistence and does not change user balances, positions, or transactions.</footer></main></body></html>`,
  };
}
