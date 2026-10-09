import type { DailyStory } from "@/lib/tone-data";
import s from "./bota.module.css";

export default function DailyBrief({ stories, date }: { stories: DailyStory[]; date: string }) {
  if (!stories.length) return null;
  const latestDay = stories[0].day;
  const brief = stories.filter((story) => story.day === latestDay).slice(0, 3);
  return <section className={s.brief} aria-labelledby="bota-brief">
    <div className={s.briefHead}>
      <span className={s.eyebrow}>Nga shtypi i huaj · në shqip</span>
      <h2 id="bota-brief">Çfarë po shkruan bota?</h2>
      <p>{date} · Një vështrim i shkurtër nga mbledhja e fundit.</p>
    </div>
    <ol className={s.briefList}>{brief.map((story, index) => <li key={story.id}>
      <span className={s.briefNumber} aria-hidden>{index + 1}</span>
      <div><p className={s.briefSource}>{story.flag} {story.country} · {story.outlet}</p>
        <h3><a href={story.url}>{story.title}</a></h3>
        {story.blurb && <p className={s.briefSummary}>{story.blurb}</p>}
        <a className={s.readLink} href={story.url}>Lexo në shqip <span aria-hidden>→</span></a>
      </div>
    </li>)}</ol>
  </section>;
}
