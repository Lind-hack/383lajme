"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DailyStory } from "@/lib/tone-data";
import BriefImage from "./brief-image";
import s from "./bota.module.css";
import { ToneTag } from "./stories";

export default function BriefStories({ stories }: { stories: DailyStory[] }) {
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const hasPhoto = (story: DailyStory) => Boolean(story.imageUrl) && !unavailable.includes(story.id);
  const lead = stories.find(hasPhoto) ?? stories[0];
  if (!lead) return null;
  const supporting = stories.filter((story) => story.id !== lead.id);
  const failed = (id: string) => setUnavailable((previous) => previous.includes(id) ? previous : [...previous, id]);

  return <div className={s.briefGrid}>
    <article className={s.leadStory}>
      <a className={s.leadVisual} href={lead.url} data-has-image={hasPhoto(lead)}>
        {hasPhoto(lead) && <BriefImage key={lead.imageUrl} src={lead.imageUrl!} lead onUnavailable={() => failed(lead.id)} />}
        <div className={s.leadCopy}>
          <p className={s.leadSource}>{lead.flag} {lead.country} · {lead.outlet}</p>
          <h3>{lead.title}</h3>
        </div>
      </a>
      <div className={s.leadBody}>
        <ToneTag tone={lead.sentiment} />
        {lead.blurb && <p className={s.briefSummary}>{lead.blurb}</p>}
        <a className={s.readLink} href={lead.url}>Lexo në shqip <ArrowUpRight size={20} aria-hidden /></a>
      </div>
    </article>
    {supporting.length > 0 && <div className={s.supportingStories}>
      {supporting.map((story) => <article className={s.supportStory} key={story.id}>
        {hasPhoto(story) && <a href={story.url} className={s.supportImageLink} aria-label={`Lexo: ${story.title}`}>
          <BriefImage src={story.imageUrl!} onUnavailable={() => failed(story.id)} />
        </a>}
        <p className={s.briefSource}>{story.flag} {story.country} · {story.outlet}</p>
        <ToneTag tone={story.sentiment} />
        <h3><a href={story.url}>{story.title}</a></h3>
        {story.blurb && <p className={s.supportSummary}>{story.blurb}</p>}
        <a className={s.readLink} href={story.url}>Lexo në shqip <ArrowUpRight size={18} aria-hidden /></a>
      </article>)}
    </div>}
  </div>;
}
