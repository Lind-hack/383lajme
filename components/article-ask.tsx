"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Article } from "@/lib/mock-data";
import { articleQuestions } from "@/lib/pyet-questions.mjs";
import { CURATED } from "@/lib/entities.mjs";
import { personalArticleQuestions } from "@/lib/dardani-memory.mjs";
import { readInterests } from "@/lib/interests.mjs";
import DardaniFace from "@/components/dardani/dardani-face";
import AskPanel, { type AskStatus, type Chip } from "./ask-panel";
import ArticleAskBubble from "./article-ask-bubble";

/**
 * Pyet Dardanin, on the article the reader is actually reading.
 *
 * The panel sits at the end of the body: the questions worth asking are the
 * ones you have after finishing, and a prompt box competing with the first
 * paragraph is a reason to leave rather than to stay. The bubble is how a
 * reader still in the middle of the piece finds out the panel exists.
 *
 * Both are driven from here so a question picked in the bubble lands in the
 * panel — one thread, one place the answer appears, no second conversation
 * floating over the article. Dardani's face and status line live here too, so
 * the card header and the collapsed bubble show the same state.
 *
 * The chips are computed, not fetched. `articleQuestions` is pure and
 * `CURATED` is static, so the openings render with the page: no request, no
 * spinner, and no generated text on screen before the reader has asked for
 * anything.
 */
export default function ArticleAsk({ article }: { article: Article }) {
  const general = useMemo(() => articleQuestions(article, CURATED), [article]);
  // The reader's own angle first — a person they follow is in this story, or it
  // is about their city. Read after mount: the interests live on the device.
  const [personal, setPersonal] = useState<Chip[]>([]);
  useEffect(() => {
    setPersonal(personalArticleQuestions(article, readInterests()));
  }, [article]);
  const chips = useMemo(() => [...personal, ...general].slice(0, 5), [personal, general]);
  const [seed, setSeed] = useState<{ question: string; nonce: number }>({
    question: "",
    nonce: 0,
  });
  const [status, setStatus] = useState<AskStatus>({
    face: "neutral",
    status: "Zgjidh një pyetje, Dardani e kërkon në arkiv",
    busy: false,
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
      <ArticleAskBubble chips={chips} onPick={pick} face={status.busy ? status.face : "neutral"} />

      <section className="pyet-block" aria-labelledby="pyet-heading" ref={panelRef}>
        <div className="pyet-head">
          <DardaniFace state={status.face} size={60} />
          <div className="pyet-head-copy">
            <h2 className="pyet-heading" id="pyet-heading">
              Pyet Dardanin për këtë lajm
            </h2>
            <p className="pyet-status" aria-live="polite">
              {status.busy && (
                <span className="pyet-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <span>{status.status}</span>
            </p>
          </div>
        </div>
        <AskPanel
          slug={article.slug}
          chips={chips}
          variant="article"
          seedQuestion={seed.question}
          seedNonce={seed.nonce}
          onStatus={setStatus}
        />
      </section>
    </>
  );
}
