/**
 * The daily dossier email.
 *
 * It replaces about twenty a day of raw route JSON (scripts/dosje_cron_report.py)
 * with one message a person can read: what was published, on which dossier,
 * with which sources, photos and videos; which articles now show it; what did
 * not make it and why; and whether the run itself was healthy.
 *
 * Built only from receipts — what the database reported it approved — never
 * from what the worker sent, so the email cannot claim a moment the trigger
 * refused. Pure: takes the run summary, returns { subject, html, text }.
 */

const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const SITE = "https://www.383ks.com";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function dayLabel(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : String(iso ?? "");
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {{
 *   date: string,
 *   mode?: string,
 *   startedAt?: string, finishedAt?: string,
 *   lunaLimited?: boolean,
 *   calls?: { luna?: number, gemini?: number },
 *   topics?: { accepted?: any[], rejected?: any[] },
 *   subjects?: Array<{ slug: string, title: string, skipped?: string, error?: string, receipt?: any }>,
 *   mapping?: { ok?: boolean, matched?: number, error?: string },
 *   errors?: string[],
 * }} run
 */
export function buildDosjeReport(run) {
  const subjects = run.subjects ?? [];
  const withWork = subjects.filter((s) => s.receipt);
  const published = withWork.filter((s) => (s.receipt.published ?? []).length || s.receipt.primer?.text || (s.receipt.videos ?? []).some((v) => v.status === "added"));
  const moments = withWork.reduce((n, s) => n + (s.receipt.published ?? []).length, 0);
  const newTopics = run.topics?.accepted ?? [];
  const failedRun = (run.errors ?? []).length > 0 && !published.length && !newTopics.length;

  const head = run.mode === "dry-run" ? "PROVË · " : failedRun ? "DËSHTOI · " : "";
  const subject = moments || published.length
    ? `383 Dosje · ${head}${dayLabel(run.date)} — ${plural(moments, "moment i ri", "momente të reja")} në ${plural(published.length, "dosje", "dosje")}`
    : `383 Dosje · ${head}${dayLabel(run.date)} — asgjë e re sot`;

  const html = [];
  const text = [];
  const h2 = (t) => {
    html.push(`<h2 style="font:700 16px/1.3 Georgia,serif;margin:28px 0 10px;border-bottom:1px solid #e5ded3;padding-bottom:6px">${esc(t)}</h2>`);
    text.push("", t.toUpperCase(), "-".repeat(t.length));
  };
  const p = (h, t = h) => {
    html.push(`<p style="margin:6px 0;font:14px/1.55 Arial,sans-serif;color:#241f1b">${h}</p>`);
    text.push(t.replace(/<[^>]+>/g, ""));
  };

  html.push(`<div style="max-width:680px;margin:0 auto;padding:20px;background:#faf6f1;color:#241f1b">`);
  html.push(`<h1 style="font:600 22px/1.2 Georgia,serif;margin:0 0 6px">${esc(subject)}</h1>`);
  text.push(subject, "=".repeat(Math.min(subject.length, 72)));
  p(
    `${plural(newTopics.length, "dosje e re", "dosje të reja")} · ${plural(moments, "moment i publikuar", "momente të publikuara")} · ` +
      `${plural(subjects.length, "temë e hulumtuar", "tema të hulumtuara")}${run.mode === "backfill" ? " · rindërtim i plotë" : ""}`
  );

  // ── 1. Published ──────────────────────────────────────────────────────────
  h2("1. Çfarë u publikua");
  if (!published.length) p("Asnjë moment nuk kaloi verifikimin sot.");
  for (const s of published) {
    const r = s.receipt;
    const link = `${SITE}/dosje/${encodeURIComponent(s.slug)}`;
    const state = r.topic?.was !== "approved" && r.topic?.now === "approved" ? " · <b>dosje e re, tani publike</b>" : "";
    html.push(`<h3 style="font:600 17px/1.3 Georgia,serif;margin:18px 0 4px"><a href="${link}" style="color:#c42a23">${esc(s.title)}</a></h3>`);
    text.push("", `■ ${s.title}  (${link})`);
    p(`Shkruar nga <b>${esc(r.model ?? "?")}</b>${state}`, `Shkruar nga ${r.model ?? "?"}${state ? " · dosje e re, tani publike" : ""}`);
    if (r.primer?.text) p(`<i>Në pak fjalë:</i> ${esc(r.primer.text)}`, `Në pak fjalë: ${r.primer.text}`);
    for (const m of r.published ?? []) {
      html.push(`<div style="margin:12px 0;padding:10px 12px;background:#fff;border-left:3px solid #e4322b">`);
      html.push(`<div style="font:700 12px Arial,sans-serif;color:#6a625a">${esc(m.display_date ?? m.event_date)}</div>`);
      html.push(`<div style="font:600 15px/1.35 Georgia,serif;margin:2px 0 6px">${esc(m.title)}</div>`);
      html.push(`<div style="font:14px/1.55 Arial,sans-serif">${esc(m.summary)}</div>`);
      if (m.why) html.push(`<div style="font:italic 14px/1.5 Georgia,serif;color:#6a625a;margin-top:6px">Pse ka rëndësi: ${esc(m.why)}</div>`);
      const cites = (m.citations ?? []).map((c) => `<a href="${esc(c.url)}">${esc(c.publisher ?? c.url)}</a>${c.live ? "" : " (vetëm arkiv)"}`).join(" · ");
      html.push(`<div style="font:12px Arial,sans-serif;color:#6a625a;margin-top:6px">Burimet: ${cites || "—"}</div></div>`);
      text.push(
        `  • ${m.display_date ?? m.event_date} — ${m.title}`,
        `    ${m.summary}`,
        ...(m.why ? [`    Pse ka rëndësi: ${m.why}`] : []),
        `    Burimet: ${(m.citations ?? []).map((c) => `${c.publisher ?? ""} ${c.url}${c.live ? "" : " (vetëm arkiv)"}`).join(" | ") || "—"}`
      );
    }
    const added = (r.videos ?? []).filter((v) => v.status === "added");
    p(
      `Video: ${added.length ? added.map((v) => `<a href="https://www.youtube.com/watch?v=${esc(v.id)}">${esc(v.title ?? v.id)}</a> (${esc(v.channel ?? "?")})`).join(" · ") : "asnjë e re"}`,
      `Video: ${added.length ? added.map((v) => `${v.title ?? v.id} (${v.channel ?? "?"}) https://www.youtube.com/watch?v=${v.id}`).join(" | ") : "asnjë e re"}`
    );
    p(
      `Foto: ${(r.photos ?? []).length ? (r.photos ?? []).map((f) => `${esc(f.credit ?? "")} · ${esc(f.license ?? "")}`).join(" · ") : "asnjë — dosja nuk publikon foto pa licencë të verifikuar"}`
    );
  }

  // ── 2. Where it shows ─────────────────────────────────────────────────────
  h2("2. Ku shfaqet");
  const showing = published.filter((s) => (s.receipt.showingOn ?? []).length);
  if (!showing.length) p("Asnjë artikull i ri nuk e shfaq ende.");
  for (const s of showing) {
    p(`<b>${esc(s.title)}</b> shfaqet te ${plural(s.receipt.showingOn.length, "artikull", "artikuj")}:`, `${s.title} shfaqet te ${s.receipt.showingOn.length} artikuj:`);
    html.push(`<ul style="margin:4px 0 10px 18px;padding:0;font:13px/1.5 Arial,sans-serif">`);
    for (const a of s.receipt.showingOn) {
      html.push(`<li><a href="${SITE}/article/${encodeURIComponent(a.slug)}">${esc(a.title)}</a></li>`);
      text.push(`  - ${a.title}  ${SITE}/article/${a.slug}`);
    }
    html.push(`</ul>`);
  }
  if (newTopics.length) {
    p("<b>Dosje të reja të krijuara sot</b> (publike vetëm pasi të kenë momentin e parë të verifikuar):", "Dosje të reja të krijuara sot:");
    for (const t of newTopics) {
      p(
        `• ${esc(t.title)} — përputhet me ${t.ownMatches} artikuj të grupit të vet, ${Math.round((t.falseRate ?? 0) * 100)}% me lajme të tjera`,
        `  • ${t.title} — ${t.ownMatches} artikuj, ${Math.round((t.falseRate ?? 0) * 100)}% me lajme të tjera`
      );
    }
  }
  if (run.mapping?.moved?.length) {
    p(`Artikuj që kaluan në një dosje tjetër pas përditësimit të fjalorit: ${run.mapping.moved.length}`);
  }

  // ── 3. What did not make it ───────────────────────────────────────────────
  h2("3. Çfarë nuk kaloi");
  const misses = [];
  for (const s of subjects) {
    if (s.skipped) misses.push([s.title, s.skipped]);
    if (s.error) misses.push([s.title, s.error]);
    for (const r of s.receipt?.refused ?? []) misses.push([`${s.title}: ${r.title}`, (r.reasons ?? []).join(", ")]);
    if (s.receipt?.primer?.refused) misses.push([`${s.title}: Në pak fjalë`, s.receipt.primer.refused.join(", ")]);
    for (const v of (s.receipt?.videos ?? []).filter((x) => x.status === "refused")) misses.push([`${s.title}: video ${v.id}`, v.reason]);
  }
  for (const t of run.topics?.rejected ?? []) misses.push([`Temë e propozuar: ${t.title || t.slug}`, (t.reasons ?? []).join(", ")]);
  if (!misses.length) p("Asgjë — çdo gjë e provuar kaloi.");
  for (const [what, why] of misses) p(`• ${esc(what)} — <span style="color:#6a625a">${esc(why)}</span>`, `  • ${what} — ${why}`);

  // ── 4. Run health ─────────────────────────────────────────────────────────
  h2("4. Gjendja e ekzekutimit");
  const mins = run.startedAt && run.finishedAt ? Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 60000) : null;
  p(
    `Mënyra: ${esc(run.mode ?? "daily")} · Thirrje Luna: ${run.calls?.luna ?? 0} · Gemini: ${run.calls?.gemini ?? 0}` +
      `${run.lunaLimited ? " · <b>Luna arriti limitin; pjesa tjetër u shkrua me Gemini</b>" : ""}${mins !== null ? ` · ${mins} min` : ""}`
  );
  p(`Lidhja e artikujve me dosjet: ${run.mapping?.ok ? `${run.mapping.matched ?? 0} përputhje` : esc(run.mapping?.error ?? "nuk u ekzekutua")}`);
  for (const e of run.errors ?? []) p(`<span style="color:#b4181a">Gabim:</span> ${esc(e)}`, `Gabim: ${e}`);

  html.push(`</div>`);
  return { subject, html: `<!doctype html><html><body style="margin:0;background:#efe9df">${html.join("\n")}</body></html>`, text: text.join("\n") };
}
