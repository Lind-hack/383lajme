"use client";

// Reading a story without leaving the reel: the whole story rises over its
// screen as a sheet — the photo, the headline, the text, the comments — and a
// drag down (or Mbyll, or Esc) puts the reader back on the same screen. At the
// bottom, "Lajmi tjetër" closes it and moves the reel on, so finishing a story
// leads straight into the next.
//
// Reading here teaches the paper exactly as the article page does
// (components/reading-affinity.tsx, measured on this sheet's own scroll).
//
// Built on <dialog> and put on <body>, like the comments, so the reel under it
// never takes its scroll, keys or taps.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { motion, useDragControls, useReducedMotion } from "framer-motion";
import { ArrowDown, ExternalLink, X } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import ReadingAffinity from "@/components/reading-affinity";
import ArticleComments from "@/components/comments/article-comments";
import type { FeedArticle } from "../per-ty-feed";
import type { StoryData } from "./story-data";
import "./reader.css";

export default function ReaderSheet({
  open,
  onClose,
  article,
  data,
  accent,
  onNext,
}: {
  open: boolean;
  onClose: () => void;
  article: FeedArticle & { coverArt?: string | null };
  data: StoryData | "off" | null;
  /** The section's colour. */
  accent: string;
  /** "Lajmi tjetër": close and move the reel on. Absent on the last screen. */
  onNext?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      scroller?.scrollTo({ top: 0 });
    }
    if (!open && el.open) el.close();
  }, [open, mounted, scroller]);

  if (!mounted) return null;
  const photo = photoFailed ? article.coverArt || null : article.imageUrl || article.coverArt || null;
  const story = data && data !== "off" ? data : null;
  const minutes = story ? Math.max(1, Math.round(story.words / 200)) : null;

  return createPortal(
    <dialog
      ref={dialog}
      className="rd-sheet"
      aria-labelledby={`rd-title-${article.slug}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ "--rd-accent": accent } as React.CSSProperties}
    >
      <motion.div
        className="rd-panel"
        drag={reduce ? false : "y"}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <header className="rd-head" onPointerDown={(e) => drag.start(e)}>
          <i className="rd-handle" aria-hidden="true" />
          <span className="rd-head-cat">{article.category}</span>
          <button type="button" className="rd-close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Mbyll lajmin">
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <div ref={setScroller} className="rd-scroll">
          {photo && (
            <div className="rd-photo">
              <Image src={photo} alt="" fill sizes="(min-width: 768px) 640px, 100vw" quality={85} style={{ objectFit: "cover" }} onError={() => setPhotoFailed(true)} />
            </div>
          )}
          <div className="rd-body">
            <p className="rd-kicker">
              <b>{article.category}</b> · <TimeAgo iso={article.publishedAt} />
              {minutes ? ` · ${minutes} min lexim` : ""}
            </p>
            <h2 id={`rd-title-${article.slug}`} className="rd-title">
              {article.title}
            </h2>
            {article.excerpt && <p className="rd-lead">{article.excerpt}</p>}

            {story ? (
              <div className="rd-text">
                {story.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : data === "off" ? (
              <p className="rd-off">Teksti i plotë nuk u ngarkua këtu.</p>
            ) : (
              <div className="rd-skeleton" aria-hidden="true">
                {[92, 100, 84, 96, 70].map((w, i) => (
                  <i key={i} style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
            {story?.caption && (
              <p className="rd-credit">
                Foto ilustruese nga arkivi. {story.caption}
                {story.credit ? ` Foto: ${story.credit}.` : ""}
              </p>
            )}

            <div className="rd-actions">
              {onNext && (
                <button type="button" className="rd-next" onClick={onNext}>
                  Lajmi tjetër <ArrowDown size={18} strokeWidth={2.6} aria-hidden="true" />
                </button>
              )}
              <Link href={`/article/${article.slug}`} className="rd-full">
                Faqja e plotë <ExternalLink size={15} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>

            {open && <ArticleComments slug={article.slug} title={article.title} accent={accent} />}
          </div>
        </div>
      </motion.div>
      {open && data !== null && (
        <ReadingAffinity
          slug={article.slug}
          title={article.title}
          excerpt={article.excerpt}
          category={article.category}
          city={story?.city ?? article.city}
          words={story?.words}
          scroller={scroller}
        />
      )}
    </dialog>,
    document.body
  );
}
