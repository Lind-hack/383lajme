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
 *   lunaOff?: boolean,
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

  const head =
    run.mode === "dry-run" ? "PROVË · " : failedRun ? "DËSHTOI · " : run.mode === "rejudge" ? "RIKONTROLL · " : "";
  const changes = run.changes ?? [];
  const changed = changes.length ? plural(changes.length, "ndryshim", "ndryshime") : "";
  const subject = moments || published.length
    ? `383 Dosje · ${head}${dayLabel(run.date)} — ${plural(moments, "moment i ri", "momente të reja")} në ${plural(published.length, "dosje", "dosje")}${changed ? ` · ${changed}` : ""}`
    : `383 Dosje · ${head}${dayLabel(run.date)} — ${changed || "asgjë e re sot"}`;

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

  // ── 0. Every change a reader can see, from dosje_changes ──────────────────
  if (changes.length) {
    h2("0. Ndryshimet");
    const block = renderChanges(changes);
    html.push(...block.html);
    text.push(...block.text);
  }

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
  // ── Re-check of what is already published ─────────────────────────────────
  const rj = run.rejudge;
  if (rj) {
    h2("Rikontrolli i momenteve të publikuara");
    p(
      `${rj.checked ?? 0} të kontrolluara · ${(rj.hidden ?? []).length} u fshehën · ${(rj.kept ?? []).length} mbetën · ${(rj.unreachable ?? []).length} pa përgjigje`
    );
    for (const h of rj.hidden ?? []) {
      p(`• <b>U fsheh:</b> ${esc(h.title)} — <span style="color:#6a625a">${esc((h.reasons ?? []).join("; "))}</span>`, `  • U fsheh: ${h.title} — ${(h.reasons ?? []).join("; ")}`);
    }
    for (const k of rj.kept ?? []) p(`• Mbeti: ${esc(k)}`, `  • Mbeti: ${k}`);
    for (const u of rj.unreachable ?? []) p(`• Pa përgjigje (provohet përsëri): ${esc(u)}`, `  • Pa përgjigje (provohet përsëri): ${u}`);
    for (const e of rj.emptied ?? []) p(`• Dosja u kthye në draft (s'ka më momente të verifikuara): ${esc(e)}`, `  • Dosja u kthye në draft: ${e}`);
  }

  h2("3. Çfarë nuk kaloi");
  const misses = [];
  for (const s of subjects) {
    if (s.skipped) misses.push([s.title, s.skipped]);
    if (s.error) misses.push([s.title, s.error]);
    // The model was asked and drafted nothing: say so, with what it was given.
    if (s.stats && s.stats.drafted === 0 && !s.error && !s.skipped) {
      misses.push([s.title, `modeli nuk propozoi asnjë moment (${statsLine(s.stats)})`]);
    }
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
      `${run.lunaOff ? " · Luna e fikur për këtë ekzekutim (pas 06:40 ose --no-luna); shkroi Gemini" : run.lunaLimited ? " · <b>Luna arriti limitin; pjesa tjetër u shkrua me Gemini</b>" : ""}${mins !== null ? ` · ${mins} min` : ""}`
  );
  p(`Lidhja e artikujve me dosjet: ${run.mapping?.ok ? `${run.mapping.matched ?? 0} përputhje` : esc(run.mapping?.error ?? "nuk u ekzekutua")}`);
  for (const e of run.errors ?? []) p(`<span style="color:#b4181a">Gabim:</span> ${esc(e)}`, `Gabim: ${e}`);
  for (const s of subjects.filter((x) => x.stats)) p(`${esc(s.title)}: ${esc(statsLine(s.stats))}`, `${s.title}: ${statsLine(s.stats)}`);

  html.push(`</div>`);
  return { subject, html: `<!doctype html><html><body style="margin:0;background:#efe9df">${html.join("\n")}</body></html>`, text: text.join("\n") };
}

/** "12 burime · 7 botues · 3 ngjarje me dy botues · 4 momente të shkruara · 2 citate nga verifikimi i kryqëzuar" */
function statsLine(st) {
  return [
    `${st.sources ?? 0} burime`,
    `${st.publishers ?? 0} botues`,
    `${st.pairs ?? 0} ngjarje me dy botues`,
    `${st.drafted ?? 0} momente të shkruara`,
    `${st.corroborated ?? 0} citate nga verifikimi i kryqëzuar`,
  ].join(" · ");
}

// ── changes (dosje_changes, migration 0119) ──────────────────────────────────

const KIND_ORDER = ["topic_new", "topic_status", "topic_text", "moment_new", "moment_text", "moment_hidden", "image", "video", "article_link", "article_unlink"];
const SYSTEM_ACTORS = /^(postgres|service_role|authenticator|supabase_admin)$/;

const momentLine = (m) => [m?.display_date, m?.title].filter(Boolean).join(" — ");

/** One line per change, grouped under its dossier. Pure; html and text in step. */
export function renderChanges(changes) {
  const html = [];
  const text = [];
  const line = (h, t) => {
    html.push(`<p style="margin:5px 0 5px 10px;font:14px/1.55 Arial,sans-serif;color:#241f1b">${h}</p>`);
    text.push(`  ${t}`);
  };
  const byTopic = new Map();
  for (const c of changes) {
    if (!byTopic.has(c.topic_slug)) byTopic.set(c.topic_slug, []);
    byTopic.get(c.topic_slug).push(c);
  }
  for (const [slug, list] of byTopic) {
    const title = list.find((c) => c.topic_title)?.topic_title ?? slug;
    const link = `${SITE}/dosje/${encodeURIComponent(slug)}`;
    html.push(`<h3 style="font:600 16px/1.3 Georgia,serif;margin:16px 0 4px"><a href="${link}" style="color:#c42a23">${esc(title)}</a></h3>`);
    text.push("", `■ ${title}  (${link})`);
    const sorted = [...list].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    for (const c of sorted) {
      const by = c.actor && !SYSTEM_ACTORS.test(c.actor) ? ` (nga ${c.actor})` : "";
      const b = c.before ?? {};
      const a = c.after ?? {};
      if (c.kind === "topic_new") {
        line(`<b>Dosje e re:</b> ${esc(a.title ?? title)} · statusi ${esc(a.status ?? "")}${esc(by)}`, `Dosje e re: ${a.title ?? title} · statusi ${a.status ?? ""}${by}`);
        if (a.primer) line(`<i>Në pak fjalë:</i> ${esc(a.primer)}`, `Në pak fjalë: ${a.primer}`);
      } else if (c.kind === "topic_status") {
        const what = a.status === "retired" ? "u tërhoq nga faqja" : a.status === "approved" ? "u publikua" : `kaloi në ${a.status}`;
        line(`<b>Dosja ${esc(what)}</b> (${esc(b.status ?? "?")} → ${esc(a.status ?? "?")})${esc(by)}`, `Dosja ${what} (${b.status ?? "?"} → ${a.status ?? "?"})${by}`);
      } else if (c.kind === "topic_text") {
        for (const f of ["title", "blurb", "primer"]) {
          if ((b[f] ?? "") === (a[f] ?? "")) continue;
          line(`<b>${esc(f)}</b> — Para: ${esc(b[f] ?? "—")}<br>Tani: ${esc(a[f] ?? "—")}${esc(by)}`, `${f} — Para: ${b[f] ?? "—"} | Tani: ${a[f] ?? "—"}${by}`);
        }
      } else if (c.kind === "moment_new") {
        line(
          `<b>Moment i ri:</b> ${esc(momentLine(a))}<br><span style="color:#6a625a">${esc(a.summary ?? "")}</span>${esc(by)}`,
          `Moment i ri: ${momentLine(a)} — ${a.summary ?? ""}${by}`
        );
      } else if (c.kind === "moment_text") {
        line(`<b>Moment i ndryshuar:</b> ${esc(momentLine(a))}${esc(by)}`, `Moment i ndryshuar: ${momentLine(a)}${by}`);
        for (const f of ["title", "display_date", "summary", "why"]) {
          if ((b[f] ?? "") === (a[f] ?? "")) continue;
          line(
            `&nbsp;&nbsp;${esc(f)} — Para: <s>${esc(b[f] ?? "—")}</s><br>&nbsp;&nbsp;Tani: ${esc(a[f] ?? "—")}`,
            `  ${f} — Para: ${b[f] ?? "—"} | Tani: ${a[f] ?? "—"}`
          );
        }
      } else if (c.kind === "moment_hidden") {
        line(`<b>U hoq nga dosja:</b> ${esc(momentLine(b))}${esc(by)}`, `U hoq nga dosja: ${momentLine(b)}${by}`);
      } else if (c.kind === "image" || c.kind === "video") {
        const label = c.kind === "image" ? "Foto" : "Video";
        const url = a.url ?? b.url ?? "";
        const state = !c.after
          ? "u hoq"
          : !c.before
            ? a.approved ? "u shtua dhe u miratua" : "u shtua, në pritje të miratimit"
            : a.approved && !b.approved ? "u miratua" : !a.approved && b.approved ? "u tërhoq" : "u ndryshua";
        line(
          `<b>${label}</b> ${esc(state)}: <a href="${esc(url)}">${esc(url)}</a>${a.credit ? ` (${esc(a.credit)})` : ""}${esc(by)}`,
          `${label} ${state}: ${url}${a.credit ? ` (${a.credit})` : ""}${by}`
        );
      } else if (c.kind === "article_link" || c.kind === "article_unlink") {
        const articleSlug = (c.kind === "article_link" ? a : b).article_slug ?? "";
        const href = `${SITE}/article/${encodeURIComponent(articleSlug)}`;
        const label = c.kind === "article_link" ? "Shfaqet tani te" : "Nuk shfaqet më te";
        line(`${label}: <a href="${href}">${esc(c.article_title ?? articleSlug)}</a>`, `${label}: ${c.article_title ?? articleSlug}  ${href}`);
      } else {
        line(esc(c.kind), String(c.kind));
      }
    }
  }
  return { html, text };
}

/**
 * Lind's rule (2026-11-02): no email on a healthy run where nothing changed.
 * A failure of any kind, a refusal worth reading, or any change always sends.
 */
export function shouldSendReport(run) {
  if (run.rejudge) return true;
  if ((run.changes ?? []).length) return true;
  if ((run.errors ?? []).length) return true;
  if (run.mapping && run.mapping.ok === false) return true;
  if ((run.topics?.accepted ?? []).length) return true;
  for (const s of run.subjects ?? []) {
    if (s.error) return true;
    // Researched and nothing drafted is worth reading too: it says why the
    // dossier is not growing.
    if (s.stats && s.stats.drafted === 0) return true;
    const r = s.receipt;
    if (r && ((r.published ?? []).length || (r.refused ?? []).length || r.primer || (r.videos ?? []).length)) return true;
  }
  return false;
}

/** The short email an admin edit sends at once. */
export function buildChangeEmail(changes) {
  const first = changes[0] ?? {};
  const subject = `383 Dosje · ndryshim nga ${first.actor ?? "admin"} — ${first.topic_title ?? first.topic_slug ?? ""}`;
  const block = renderChanges(changes);
  const html =
    `<!doctype html><html><body style="margin:0;background:#efe9df"><div style="max-width:680px;margin:0 auto;padding:20px;background:#faf6f1;color:#241f1b">` +
    `<h1 style="font:600 20px/1.2 Georgia,serif;margin:0 0 6px">${esc(subject)}</h1>${block.html.join("\n")}</div></body></html>`;
  return { subject, html, text: [subject, "=".repeat(Math.min(subject.length, 72)), ...block.text].join("\n") };
}
