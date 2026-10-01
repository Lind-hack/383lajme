// The whole feature in three steps, before any number: what we read, what we
// decide about each story, and what the index is. Step one carries today's
// real counts so the explanation is also evidence.

import { ArrowRight, Gauge, Newspaper, Scale } from "lucide-react";
import { ToneTag } from "./stories";
import s from "./bota.module.css";

export default function HowItWorks({ articles, sources }: { articles: number; sources: number }) {
  return (
    <ol className={s.steps} aria-label="Si funksionon">
      <li className={s.step}>
        <span className={s.stepIcon} aria-hidden><Newspaper size={20} strokeWidth={2.2} /></span>
        <span className={s.stepBody}>
          <strong>Lexojmë shtypin e huaj</strong>
          <span>
            {articles > 0
              ? `${articles} artikuj nga ${sources} media sot`
              : "Nga shtypi ndërkombëtar, çdo ditë"}
          </span>
        </span>
      </li>
      <li className={s.stepArrow} aria-hidden><ArrowRight size={18} strokeWidth={2.2} /></li>
      <li className={s.step}>
        <span className={s.stepIcon} aria-hidden><Scale size={20} strokeWidth={2.2} /></span>
        <span className={s.stepBody}>
          <strong>Vlerësojmë portretizimin</strong>
          <span className={s.stepTags}>
            <ToneTag tone="positive" />
            <ToneTag tone="neutral" />
            <ToneTag tone="negative" />
          </span>
        </span>
      </li>
      <li className={s.stepArrow} aria-hidden><ArrowRight size={18} strokeWidth={2.2} /></li>
      <li className={s.step}>
        <span className={s.stepIcon} aria-hidden><Gauge size={20} strokeWidth={2.2} /></span>
        <span className={s.stepBody}>
          <strong>Nxjerrim indeksin e ditës</strong>
          <span>0 negativ · 50 neutral · 100 pozitiv</span>
        </span>
      </li>
    </ol>
  );
}
