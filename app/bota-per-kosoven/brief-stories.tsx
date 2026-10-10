"use client";

// The day's three stories, as three equal front-page columns: photo, where it
// came from, how it portrays Kosovo, the translated headline, the gist, and the
// way in. Same structure and height side by side, so the eye compares the
// countries rather than the card sizes. A photo that fails to load leaves the
// country's postmark in its place, not an empty box.

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DailyStory } from "@/lib/tone-data";
import BriefImage from "./brief-image";
import s from "./bota.module.css";
import { linkProps, readLabel, ToneTag } from "./stories";

export default function BriefStories({ stories }: { stories: DailyStory[] }) {
  const [unavailable, setUnavailable] = useState<string[]>([]);
  if (!stories.length) return null;
  const failed = (id: string) => setUnavailable((previous) => (previous.includes(id) ? previous : [...previous, id]));

  return (
    <div className={s.briefGrid} data-count={stories.length}>
      {stories.map((story) => {
        const photo = Boolean(story.imageUrl) && !unavailable.includes(story.id);
        return (
          <article className={s.briefCard} key={story.id}>
            <a href={story.url} className={s.briefVisual} tabIndex={-1} aria-hidden="true" {...linkProps(story)}>
              {photo ? (
                <BriefImage key={story.imageUrl} src={story.imageUrl!} onUnavailable={() => failed(story.id)} />
              ) : (
                <span className={s.postmark}>
                  <span>{story.country}</span>
                </span>
              )}
            </a>
            <div className={s.briefBody}>
              <p className={s.briefStamp}>
                {story.flag && <span className={s.briefCode}>{story.flag}</span>}
                <span>
                  {story.country} · {story.outlet}
                </span>
              </p>
              <ToneTag tone={story.sentiment} />
              <h3 className={s.briefTitle}>
                <a href={story.url} {...linkProps(story)}>
                  {story.title}
                </a>
              </h3>
              {story.blurb && <p className={s.briefSummary}>{story.blurb}</p>}
              <a className={s.readLink} href={story.url} {...linkProps(story)}>
                {readLabel(story)} <ArrowUpRight size={18} aria-hidden />
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
