"use client";

// The day's news, one entry per story rather than per article: when several
// outlets ran the same event, it is listed once with every outlet underneath.
// Each entry carries its receipt — the headline as the outlet published it,
// when it was published and collected, why it was rated the way it was, and a
// way to tell us the rating is wrong — so a reader can check every number.

import { useState } from "react";
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { DailyStory } from "@/lib/tone-data";
import { sqCompare } from "@/lib/sq-order.mjs";
import { linkProps, readLabel } from "@/lib/bota-links";
import s from "./bota.module.css";

type Filter = "all" | DailyStory["sentiment"];

const TONE: Record<DailyStory["sentiment"], { label: string; why: string; Icon: typeof Minus }> = {
  positive: { label: "Pozitiv", why: "Pse pozitiv", Icon: TrendingUp },
  negative: { label: "Negativ", why: "Pse negativ", Icon: TrendingDown },
  neutral: { label: "Neutrale", why: "Pse neutral", Icon: Minus },
};

/** Enough to cover the good and bad news on a typical day before the neutral
 *  bulk; the rest is one tap away rather than a long scroll by default. */
const FIRST_PAGE = 8;

const REPORT_TO = "info@383media.com";

export function ToneTag({ tone }: { tone: DailyStory["sentiment"] }) {
  const { label, Icon } = TONE[tone];
  return (
    <span className={s.tag} data-tone={tone}>
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      {label}
    </span>
  );
}

const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
/** "9 tetor" from a YYYY-MM-DD day key. */
export function dayName(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return m && d && m <= 12 ? `${d} ${MONTHS[m - 1]}` : day;
}
/** "dje" for the day before `today`, else "9 tetor". */
function dayLabel(day: string, today: string) {
  const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`);
  return diff === 86_400_000 ? "dje" : dayName(day);
}

function reportHref(story: DailyStory) {
  const subject = `Vlerësim i gabuar në Bota për Kosovën`;
  const body = `Artikulli: ${story.sourceUrl}\nVlerësimi ynë: ${TONE[story.sentiment].label}\nPse mendoj se është gabim: `;
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function StoryItem({ story, today }: { story: DailyStory; today: string | null }) {
  const lead = story.coverage[0];
  const others = story.coverage.slice(1);
  const countries = new Set(story.coverage.map((c) => c.country)).size;
  return (
    <article className={s.item}>
      <div className={s.itemMain}>
        <p className={s.itemMeta}>
          <ToneTag tone={story.sentiment} />
          <span>
            {story.flag} {story.country} · {story.outlet}
            {today && story.day !== today && ` · ${dayLabel(story.day, today)}`}
          </span>
        </p>
        <h3 className={s.itemTitle}>
          <a href={story.url} {...linkProps(story)}>{story.title}</a>
        </h3>
        {story.blurb && <p className={s.itemSummary}>{story.blurb}</p>}

        <dl className={s.receipt}>
          {story.reason && (
            <div>
              <dt>{TONE[story.sentiment].why}</dt>
              <dd>
                {story.reason}
                {story.evidence && <> <q className={s.evidenceQuote}>{story.evidence}</q></>}
              </dd>
            </div>
          )}
          <div>
            <dt>Titulli origjinal</dt>
            <dd className={s.originalTitle}>{story.originalTitle}</dd>
          </div>
          <div>
            <dt>Burimi</dt>
            <dd>
              {story.outlet}
              {lead?.publishedOn ? ` · botuar ${dayName(lead.publishedOn)}` : ""}
              {` · mbledhur ${dayName(story.day)}`}
            </dd>
          </div>
        </dl>

        {others.length > 0 && (
          <div className={s.coverage}>
            <p>
              E shkruan {story.coverage.length} gazeta
              {countries > 1 ? ` nga ${countries} vende` : ""}:
            </p>
            <ul>
              {story.coverage.map((c) => (
                <li key={c.sourceUrl}>
                  <a href={c.url} {...linkProps(c)} title={c.originalTitle}>
                    <span className={s.coverageDot} data-tone={c.sentiment} aria-hidden />
                    <span>{c.flag} {c.outlet}</span>
                    <span className={s.coverageTone}>{TONE[c.sentiment].label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={s.itemActions}>
          <a className={s.readLink} href={story.url} {...linkProps(story)}>
            {readLabel(story)} <span aria-hidden>→</span>
          </a>
          {story.translated && (
            <a className={s.sourceLink} href={story.sourceUrl} target="_blank" rel="noopener noreferrer">
              Origjinali te {story.outlet} <ArrowUpRight size={15} aria-hidden />
            </a>
          )}
          <a className={s.reportLink} href={reportHref(story)}>Vlerësim i gabuar?</a>
        </div>
      </div>
      {story.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote publisher images, already resized by remoteImageSrc
        <img
          className={s.thumb}
          src={story.imageUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </article>
  );
}

export default function Stories({
  stories,
  today,
  featured = [],
}: {
  stories: DailyStory[];
  today: string | null;
  /** Already shown in the brief above; left out of the unfiltered list. */
  featured?: string[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const countries = [...new Set(stories.flatMap((story) => story.coverage.map((c) => c.country)))].sort(sqCompare);

  const needle = query.trim().toLocaleLowerCase("sq");
  // Country and search narrow first; the tone chips then count what is left, so
  // a chip never promises stories the results line cannot show. Browsing with
  // no filter, the brief's stories are not listed a second time.
  const narrowed = stories.filter((story) =>
    (!country || story.coverage.some((c) => c.country === country)) &&
    (!needle ||
      `${story.title} ${story.blurb ?? ""} ${story.coverage.map((c) => `${c.outlet} ${c.country} ${c.originalTitle}`).join(" ")}`
        .toLocaleLowerCase("sq")
        .includes(needle))
  );
  const pool = !country && !needle && featured.length ? narrowed.filter((story) => !featured.includes(story.id)) : narrowed;

  const count = (t: DailyStory["sentiment"]) => pool.filter((x) => x.sentiment === t).length;
  const options: Array<{ key: Filter; label: string; n: number }> = [
    { key: "all", label: "Të gjitha", n: pool.length },
    { key: "positive", label: "Pozitive", n: count("positive") },
    { key: "negative", label: "Negative", n: count("negative") },
    { key: "neutral", label: "Neutrale", n: count("neutral") },
  ];

  const shown = pool.filter((story) => filter === "all" || story.sentiment === filter);
  const visible = expanded ? shown : shown.slice(0, FIRST_PAGE);

  return (
    <>
      <div className={s.findStories}>
        <label>Çfarë të intereson?
          <input type="search" value={query} placeholder="Kërko një temë ose gazetë" onChange={(event) => { setQuery(event.target.value); setExpanded(false); }} />
        </label>
        <label>Nga cili vend?
          <select aria-label="Nga cili vend?" value={country} onChange={(event) => { setCountry(event.target.value); setExpanded(false); }}>
            <option value="">Të gjitha vendet</option>
            {countries.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <p className={s.filterHint}>Si e portretizon lajmi Kosovën:</p>
      <div className={s.filters} role="group" aria-label="Filtro lajmet">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={s.filter}
            aria-pressed={filter === o.key}
            disabled={o.n === 0 && o.key !== "all"}
            onClick={() => {
              setFilter(o.key);
              setExpanded(false);
            }}
          >
            {o.label} <span>{o.n}</span>
          </button>
        ))}
      </div>

      <div className={s.results}>
        <p role="status">
          {shown.length} {shown.length === 1 ? "lajm" : "lajme"}
          {!expanded && shown.length > FIRST_PAGE ? ` · po shfaqen ${FIRST_PAGE}` : ""}
        </p>
        {(country || query || filter !== "all") && <button type="button" onClick={() => { setCountry(""); setQuery(""); setFilter("all"); setExpanded(false); }}>Hiq filtrat</button>}
      </div>

      <div className={s.panel}>
        {visible.length === 0 ? (
          <p className={s.empty}>
            {stories.length === 0
              ? "Lajmet e sotme ende po mblidhen dhe vlerësohen. Kthehu pas pak."
              : "Nuk gjetëm lajme me këta filtra. Provo një temë tjetër ose hiqi filtrat."}
          </p>
        ) : (
          <ul className={s.list}>
            {visible.map((story) => (
              <li key={story.id}>
                <StoryItem story={story} today={today} />
              </li>
            ))}
          </ul>
        )}
        {shown.length > FIRST_PAGE && (
          <button type="button" className={s.more} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Trego më pak" : `Shfaq të gjitha (${shown.length})`}
          </button>
        )}
      </div>
    </>
  );
}
