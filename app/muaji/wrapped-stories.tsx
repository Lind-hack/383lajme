"use client";

// Plays "Tetori në 383" as story cards: progress bars on top, tap right for
// the next card and left for the one before, arrow keys on a computer. Cards
// move on by themselves every six seconds, with a pause button (and never with
// reduced motion), the way a story does.
//
// Every card is the shareable image itself; "Shkarko" saves it and "Ndaj"
// hands it to the phone's share sheet for Stories, TikTok or Reels. The last
// card is the reader's own — how many of the month's stories they read, from
// the ledger on their device — and points at the yearly wrapped in December.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Download, Pause, Play, RotateCcw, Share2 } from "lucide-react";
import DardaniImage from "@/components/dardani/dardani-image";
import { readLedger, summarize } from "@/lib/reader-ledger.mjs";
import type { WrappedCard } from "@/lib/monthly-wrapped.mjs";

export type StoryCard = { card: WrappedCard; src: string; alt: string; story: string | null };

const STEP_MS = 6000;

export default function WrappedStories({
  month,
  title,
  monthName,
  total,
  cards,
}: {
  month: string;
  title: string;
  /** Definite, as "Kaq ishte tetori" needs: "Tetori". */
  monthName: string;
  total: number;
  cards: StoryCard[];
}) {
  const count = cards.length + 1; // the closing card is the reader's own
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mine, setMine] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMine(summarize(readLedger(), { from: month, to: month }).reads);
    // Fetch every card now, so each one is there the moment it is reached.
    for (const c of cards) new window.Image().src = c.src;
  }, [month, cards]);

  const go = useCallback((to: number) => setIndex(Math.max(0, Math.min(count - 1, to))), [count]);
  const autoplay = !paused && !reduced && index < count - 1;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => go(index + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  const current = cards[index] ?? null;
  const shareText = useMemo(() => `${title} — muaji në lajme. 383ks.com/muaji/${month}`, [title, month]);

  async function fileOf(card: StoryCard) {
    const blob = await fetch(card.src).then((r) => r.blob());
    return new File([blob], `383-${month}-${card.card}.png`, { type: "image/png" });
  }

  async function download(card: StoryCard) {
    try {
      const file = await fileOf(card);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNote("Nuk u shkarkua. Provo sërish.");
    }
  }

  async function share(card: StoryCard | null) {
    setPaused(true);
    try {
      if (card) {
        const file = await fileOf(card);
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title, text: shareText });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title, text: shareText, url: `${location.origin}/muaji/${month}` });
        return;
      }
      await navigator.clipboard.writeText(`${location.origin}/muaji/${month}`);
      setNote("Lidhja u kopjua.");
    } catch {
      // The reader closed the share sheet; nothing to say.
    }
  }

  return (
    <main className="wr-page">
      <section className="wr-stage" aria-roledescription="histori" aria-label={title}>
        <div className="wr-bars" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} data-state={i < index ? "done" : i === index ? "now" : undefined}>
              <i
                key={`${index}-${paused}-${reduced}`}
                style={i === index && autoplay ? { animationDuration: `${STEP_MS}ms` } : undefined}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          className="wr-pause"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused || reduced ? "Luaj" : "Ndalo"}
          hidden={index === count - 1}
        >
          {paused || reduced ? <Play size={18} strokeWidth={2.6} /> : <Pause size={18} strokeWidth={2.6} />}
        </button>

        <div className="wr-card">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt={current.alt} width={1080} height={1920} className="wr-img" />
          ) : (
            <div className="wr-end">
              <DardaniImage name="celebrating" alt="Dardani feston" className="wr-end-img" unoptimized />
              <h1>Kaq ishte {monthName.toLowerCase()}.</h1>
              <p className="wr-end-total">{total.toLocaleString("de-DE")} lajme, në një vend.</p>
              {mine !== null && mine > 0 && (
                <p className="wr-end-mine">
                  Ti lexove <b>{mine}</b> prej tyre.
                </p>
              )}
              <p className="wr-end-tease">
                Në dhjetor vjen <b>Viti yt me 383</b>: njerëzit, qyteti dhe zakonet e tua të leximit.
              </p>
              <div className="wr-end-actions">
                <button type="button" className="perty-btn perty-btn--primary" onClick={() => share(null)}>
                  <Share2 size={16} strokeWidth={2.4} aria-hidden="true" /> Ndaj muajin
                </button>
                <button type="button" className="perty-btn perty-btn--ghost" onClick={() => go(0)}>
                  <RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" /> Shiko sërish
                </button>
                <Link href="/per-ty" className="perty-btn perty-btn--ghost">
                  Kthehu te 383 <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
          {/* Tap zones: left goes back, right goes on. Buttons, so a keyboard and
              a screen reader can use them too. */}
          {current && (
            <>
              <button type="button" className="wr-tap wr-tap--back" onClick={() => go(index - 1)} aria-label="Karta e mëparshme" disabled={index === 0} />
              <button type="button" className="wr-tap wr-tap--next" onClick={() => go(index + 1)} aria-label="Karta tjetër" />
            </>
          )}
        </div>

        <p className="wr-sr" aria-live="polite">
          Karta {index + 1} nga {count}
        </p>

        {current && (
          <div className="wr-actions">
            <button type="button" className="wr-action" onClick={() => download(current)}>
              <Download size={17} strokeWidth={2.4} aria-hidden="true" /> Shkarko
            </button>
            <button type="button" className="wr-action" onClick={() => share(current)}>
              <Share2 size={17} strokeWidth={2.4} aria-hidden="true" /> Ndaj
            </button>
            {current.story && (
              <Link href={`/article/${current.story}`} className="wr-action">
                <BookOpen size={17} strokeWidth={2.4} aria-hidden="true" /> Lexo lajmin
              </Link>
            )}
          </div>
        )}
        {note && (
          <p className="wr-note" role="status">
            {note}
          </p>
        )}
      </section>
    </main>
  );
}
