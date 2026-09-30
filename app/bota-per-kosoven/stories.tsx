"use client";

// The stories behind today's number. One list, one filter: a reader who wants
// only the bad news gets it in one tap, and nothing else on the page changes.

import { useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { DailyStory } from "@/lib/tone-data";
import s from "./bota.module.css";

type Filter = "all" | DailyStory["sentiment"];

const TONE: Record<DailyStory["sentiment"], { label: string; Icon: typeof Minus }> = {
  positive: { label: "E mirë", Icon: TrendingUp },
  negative: { label: "E keqe", Icon: TrendingDown },
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

export default function Stories({ stories, today }: { stories: DailyStory[]; today: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);

  const count = (t: DailyStory["sentiment"]) => stories.filter((x) => x.sentiment === t).length;
  const options: Array<{ key: Filter; label: string; n: number }> = [
    { key: "all", label: "Të gjitha", n: stories.length },
    { key: "positive", label: "Të mira", n: count("positive") },
    { key: "negative", label: "Të këqija", n: count("negative") },
    { key: "neutral", label: "Neutrale", n: count("neutral") },
  ];

  const shown = filter === "all" ? stories : stories.filter((x) => x.sentiment === filter);
  const visible = expanded ? shown : shown.slice(0, FIRST_PAGE);

  return (
    <>
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

      <div className={s.panel}>
        {visible.length === 0 ? (
          <p className={s.empty}>
            {stories.length === 0
              ? "Lajmet e sotme ende po mblidhen dhe vlerësohen. Kthehu pas pak."
              : "Asnjë lajm i këtij lloji sot."}
          </p>
        ) : (
          <ul className={s.list}>
            {visible.map((x) => (
              <li key={x.id}>
                <a className={s.story} href={x.url} target="_blank" rel="noopener noreferrer">
                  <ToneTag tone={x.sentiment} />
                  <span>
                    <span className={s.storyTitle}>{x.title}</span>
                    <span className={s.storyMeta}>
                      {x.outlet} · {x.country}
                      {x.alsoIn.length > 0 &&
                        ` · edhe ${x.alsoIn.length} ${x.alsoIn.length === 1 ? "media tjetër" : "media të tjera"}`}
                      {today && x.day !== today && " · dje"}
                    </span>
                    {x.evidence && <q className={s.evidence}>{x.evidence}</q>}
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
