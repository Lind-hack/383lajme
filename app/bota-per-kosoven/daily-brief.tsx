import type { DailyStory } from "@/lib/tone-data";
import s from "./bota.module.css";
import BriefStories from "./brief-stories";

export default function DailyBrief({ stories, date }: { stories: DailyStory[]; date: string }) {
  if (!stories.length) return null;
  const latestDay = stories[0].day;
  const brief = stories.filter((story) => story.day === latestDay).slice(0, 3);
  return <section className={s.brief} aria-labelledby="bota-brief">
    <div className={s.briefHead}>
      <h2 id="bota-brief">Çfarë po shkruan bota?</h2>
      <p>{date} · Një vështrim i shkurtër nga mbledhja e fundit.</p>
    </div>
    <BriefStories stories={brief} />
  </section>;
}
