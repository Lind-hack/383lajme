"use client";

import { useMemo } from "react";
import type { Article } from "@/lib/mock-data";
import { articleQuestions } from "@/lib/pyet-questions.mjs";
import { CURATED } from "@/lib/entities.mjs";
import AskPanel from "./ask-panel";

/**
 * Pyet 383, on the article the reader is actually reading.
 *
 * Placed at the end of the body rather than beside it: the questions worth
 * asking are the ones you have after finishing, and a prompt box competing
 * with the first paragraph is a reason to leave, not to stay.
 *
 * The chips are computed here rather than fetched. `articleQuestions` is pure
 * and `CURATED` is a static list, so the openings render with the page — no
 * request, no spinner, and no generated text on screen before the reader has
 * asked for anything.
 */
export default function ArticleAsk({ article }: { article: Article }) {
  const chips = useMemo(() => articleQuestions(article, CURATED), [article]);

  return (
    <section className="pyet-block" aria-labelledby="pyet-heading">
      <h2 className="pyet-heading" id="pyet-heading">
        Pyet 383 për këtë lajm
      </h2>
      <p className="pyet-sub">
        Përgjigjet vijnë vetëm nga artikujt e botuar te 383, me burimet e lidhura.
      </p>
      <AskPanel slug={article.slug} chips={chips} variant="article" />
    </section>
  );
}
