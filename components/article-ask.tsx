"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Article } from "@/lib/mock-data";
import { articleQuestions } from "@/lib/pyet-questions.mjs";
import { CURATED } from "@/lib/entities.mjs";
import AskPanel from "./ask-panel";
import ArticleAskBubble from "./article-ask-bubble";

/**
 * Pyet 383, on the article the reader is actually reading.
 *
 * The panel sits at the end of the body: the questions worth asking are the
 * ones you have after finishing, and a prompt box competing with the first
 * paragraph is a reason to leave rather than to stay. The bubble is how a
 * reader still in the middle of the piece finds out the panel exists.
 *
 * Both are driven from here so a question picked in the bubble lands in the
 * panel — one thread, one place the answer appears, no second conversation
 * floating over the article.
 *
 * The chips are computed, not fetched. `articleQuestions` is pure and
 * `CURATED` is static, so the openings render with the page: no request, no
 * spinner, and no generated text on screen before the reader has asked for
 * anything.
 */
export default function ArticleAsk({ article }: { article: Article }) {
  const chips = useMemo(() => articleQuestions(article, CURATED), [article]);
  const [seed, setSeed] = useState<{ question: string; nonce: number }>({
    question: "",
    nonce: 0,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const pick = useCallback((question: string) => {
    setSeed((prev) => ({ question, nonce: prev.nonce + 1 }));
    // The answer is about to appear at the foot of the article, which is off
    // screen for a reader who asked from the bubble. Bring them to it.
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <>
      <ArticleAskBubble chips={chips} onPick={pick} />

      <section className="pyet-block" aria-labelledby="pyet-heading" ref={panelRef}>
        <h2 className="pyet-heading" id="pyet-heading">
          Pyet 383 për këtë lajm
        </h2>
        <p className="pyet-sub">
          Përgjigjet vijnë vetëm nga artikujt e botuar te 383, me burimet e lidhura.
        </p>
        <AskPanel
          slug={article.slug}
          chips={chips}
          variant="article"
          seedQuestion={seed.question}
          seedNonce={seed.nonce}
        />
      </section>
    </>
  );
}
