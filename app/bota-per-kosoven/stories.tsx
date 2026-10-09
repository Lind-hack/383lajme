"use client";

import { useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { DailyStory } from "@/lib/tone-data";
import s from "./bota.module.css";

type Filter = "all" | DailyStory["sentiment"];

const TONE: Record<DailyStory["sentiment"], { label: string; Icon: typeof Minus }> = {
  positive: { label: "Pozitiv", Icon: TrendingUp },
  negative: { label: "Negativ", Icon: TrendingDown },
  neutral: { label: "Neutrale", Icon: Minus },
};

/** Enough to cover the good and bad news on a typical day before the neutral
 *  bulk; the rest is one tap away rather than a long scroll by default. */
const FIRST_PAGE = 8;

export function ToneTag({ tone }: { tone: DailyStory["sentiment"] }) {
  const { label, Icon } = TONE[tone];
  return (
    <span className={s.tag} data-tone={tone}>
      <Icon size={14} strokeWidth={2.6} aria-hidden />
      {label}
    </span>
  );
}

/** "dje" for the day before `today`, else "9 tetor". Day keys are YYYY-MM-DD. */
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
function dayLabel(day: string, today: string) {
  const diff = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`);
  if (diff === 86_400_000) return "dje";
  const [, m, d] = day.split("-").map(Number);
  return m && d ? `${d} ${MONTHS[m - 1]}` : day;
}

/** A story with an Albanian reader page says so; one without opens the publisher. */
export function readLabel(story: Pick<DailyStory, "translated">) {
  return story.translated ? "Lexo në shqip" : "Lexo origjinalin";
}
export function linkProps(story: Pick<DailyStory, "translated">) {
  return story.translated ? {} : { target: "_blank", rel: "noopener noreferrer" };
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
  const countries = [...new Set(stories.map((story) => story.country))].sort((a, b) => a.localeCompare(b, "sq"));

  const needle = query.trim().toLocaleLowerCase("sq");
  // Country and search narrow first; the tone chips then count what is left, so
  // a chip never promises stories the results line cannot show. Browsing with
  // no filter, the brief's stories are not listed a second time.
  const narrowed = stories.filter((story) =>
    (!country || story.country === country) &&
    (!needle || `${story.title} ${story.blurb ?? ""} ${story.outlet} ${story.country}`.toLocaleLowerCase("sq").includes(needle))
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
      <p className={s.filterHint}>Si e portretizon artikulli Kosovën:</p>
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
        <p role="status">{shown.length} {shown.length === 1 ? "artikull" : "artikuj"}{!expanded && shown.length > FIRST_PAGE ? ` · po shfaqen ${FIRST_PAGE}` : ""}</p>
        {(country || query || filter !== "all") && <button type="button" onClick={() => { setCountry(""); setQuery(""); setFilter("all"); setExpanded(false); }}>Hiq filtrat</button>}
      </div>

      <div className={s.panel}>
        {visible.length === 0 ? (
          <p className={s.empty}>
            {stories.length === 0
              ? "Lajmet e sotme ende po mblidhen dhe vlerësohen. Kthehu pas pak."
              : "Nuk gjetëm artikuj me këta filtra. Provo një temë tjetër ose hiqi filtrat."}
          </p>
        ) : (
          <ul className={s.list}>
            {visible.map((x) => (
              <li key={x.id}>
                <a className={s.story} href={x.url} {...linkProps(x)}>
                  <ToneTag tone={x.sentiment} />
                  <span>
                    <span className={s.storyTitle}>{x.title}</span>
                    <span className={s.storyMeta}>
                      {x.flag} {x.country} · {x.outlet}
                      {x.alsoIn.length > 0 &&
                        ` · edhe ${x.alsoIn.length} ${x.alsoIn.length === 1 ? "media tjetër" : "media të tjera"}`}
                      {today && x.day !== today && ` · ${dayLabel(x.day, today)}`}
                    </span>
                    {x.blurb && <span className={s.storySummary}>{x.blurb}</span>}
                    <span className={s.readLink}>{readLabel(x)} <span aria-hidden>→</span></span>
                  </span>
                  {x.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote publisher images, already resized by remoteImageSrc
                    <img
                      className={s.thumb}
                      src={x.imageUrl}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </a>
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
