"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Check,
  Flame,
  HelpCircle,
  Laugh,
  Play,
  Sparkles,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";

import {
  REACTIONS,
  type ReactionKey,
  type ReagimiView,
  activeStreak,
  advanceStreak,
  dateKeyInKosovo,
  emptyCounts,
  embedUrl,
  formatAlbanianDate,
  isReactionKey,
  parseStreak,
  previousDateKey,
  reactionCountLabel,
  reactionLabel,
  reactionPercentages,
  relativeDayLabel,
  tallyReactions,
  thumbnailCandidates,
  youtubeId,
} from "@/lib/reagimi-data";

/** lucide components keyed by the icon name held in REACTIONS. */
const ICONS = { Flame, HelpCircle, Laugh, ThumbsUp, Sparkles } as const;

const VOTER_KEY = "383_voter_id"; // shared with DailyPoll: one anonymous identity
const STREAK_KEY = "383_reagimi_streak";

type DailyRow = {
  reagimi_date: string;
  quote: string;
  speaker_name: string;
  speaker_role: string | null;
  context_line: string | null;
  article_slug: string | null;
  video_url: string | null;
};

type ReactionRow = { reagimi_date: string; reaction: string; voter_id: string };

export interface ReagimiDitesProps {
  /**
   * View resolved on the server from the articles already on the page, so the card
   * paints with real content instead of a spinner.
   */
  fallbackView: ReagimiView | null;
  /**
   * The date the server used. The page is statically revalidated hourly, so after
   * midnight this can lag the real Kosovo date by up to an hour. The client treats
   * its own clock as authoritative and discards a fallback built for another day,
   * which is what keeps a stale card off the page.
   */
  serverDateKey: string;
}

export default function ReagimiDites({ fallbackView, serverDateKey }: ReagimiDitesProps) {
  // Date is resolved on the client. Starts as the server's guess to keep the first
  // paint stable, then corrects on mount if the two disagree.
  const [todayKey, setTodayKey] = useState(serverDateKey);
  const [curated, setCurated] = useState<ReagimiView | null>(null);
  const [dateChecked, setDateChecked] = useState(false);

  const [counts, setCounts] = useState<Record<ReactionKey, number>>(emptyCounts);
  const [myReaction, setMyReaction] = useState<ReactionKey | null>(null);
  const [pending, setPending] = useState(false);
  const [streak, setStreak] = useState(0);

  /**
   * Bars hold at zero for one committed frame so the CSS transition has something
   * to animate from. Without this the results block mounts with its final width
   * already applied and the reveal, the actual payoff for reacting, never plays.
   */
  const [barsArmed, setBarsArmed] = useState(false);

  useEffect(() => {
    if (myReaction === null) {
      setBarsArmed(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setBarsArmed(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [myReaction]);

  const [yesterday, setYesterday] = useState<{
    dateKey: string;
    lead: string;
    slug: string | null;
    top: ReactionKey | null;
    pct: number;
  } | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [clipState, setClipState] = useState<"idle" | "searching" | "ready" | "none">("idle");
  const [thumbIndex, setThumbIndex] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /**
   * The dialog is portalled to <body>.
   *
   * The card runs an entrance animation whose final keyframe leaves a transform on
   * the <section>, and any non-none transform makes that element the containing
   * block for `position: fixed` descendants. Rendered in place, the "fullscreen"
   * overlay was therefore clipped to the card: the page behind stayed undimmed and
   * the reactions fell below the fold. A portal puts it outside that ancestor for
   * good, which is what a modal wants regardless.
   */
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setPortalTarget(document.body), []);
  /** Set once the clip has actually been opened, so the reaction prompt can stop
   *  asking people to react to something they have not seen yet. */
  const [watched, setWatched] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const voterRef = useRef("");

  // ── Which view is live: curated wins, else the server fallback, but only if the
  //    fallback was built for the day we are actually on. ────────────────────────
  const view: ReagimiView | null = useMemo(() => {
    if (curated) return curated;
    if (!fallbackView) return null;
    if (fallbackView.dateKey !== todayKey) return null; // built for a different day
    return fallbackView;
  }, [curated, fallbackView, todayKey]);

  // ── Identity, date, streak ──────────────────────────────────────────────────
  useEffect(() => {
    const key = dateKeyInKosovo();
    setTodayKey(key);
    setDateChecked(true);

    let id = "";
    try {
      id = localStorage.getItem(VOTER_KEY) ?? "";
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(VOTER_KEY, id);
      }
      setStreak(activeStreak(parseStreak(localStorage.getItem(STREAK_KEY)), key));
    } catch {
      // Private mode or blocked storage. Reacting still works for the session.
      id = id || crypto.randomUUID();
    }
    voterRef.current = id;
  }, []);

  // ── Load curated rows + reactions for today and yesterday ───────────────────
  useEffect(() => {
    if (!dateChecked) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      // No backend configured: the card still renders the fallback, read-only.
      return;
    }

    const supabase = createClient(url, anon);
    supabaseRef.current = supabase;

    const prevKey = previousDateKey(todayKey);
    let cancelled = false;

    (async () => {
      const [dailyRes, reactionRes] = await Promise.all([
        supabase
          .from("reagimi_daily")
          .select("reagimi_date, quote, speaker_name, speaker_role, context_line, article_slug, video_url")
          .in("reagimi_date", [todayKey, prevKey]),
        supabase
          .from("reagimi_reactions")
          .select("reagimi_date, reaction, voter_id")
          .in("reagimi_date", [todayKey, prevKey]),
      ]);

      if (cancelled) return;

      const rows = (dailyRes.data ?? []) as DailyRow[];
      const todayRow = rows.find((r) => r?.reagimi_date === todayKey);
      const prevRow = rows.find((r) => r?.reagimi_date === prevKey);

      if (todayRow) {
        setCurated({
          source: "curated",
          dateKey: todayRow.reagimi_date,
          lead: todayRow.quote,
          attributionName: todayRow.speaker_name,
          attributionRole: todayRow.speaker_role ?? null,
          contextLine: todayRow.context_line ?? null,
          articleSlug: todayRow.article_slug ?? null,
          videoUrl: todayRow.video_url ?? null,
          quoted: true,
        });
      }

      const allReactions = (reactionRes.data ?? []) as ReactionRow[];
      const todays = allReactions.filter((r) => r?.reagimi_date === todayKey);
      const tally = tallyReactions(todays);
      setCounts(tally.counts);

      const mine = todays.find((r) => r?.voter_id === voterRef.current)?.reaction;
      if (isReactionKey(mine)) setMyReaction(mine);

      if (prevRow) {
        const prevTally = tallyReactions(allReactions.filter((r) => r?.reagimi_date === prevKey));
        const prevPct = reactionPercentages(prevTally);
        setYesterday({
          dateKey: prevKey,
          lead: prevRow.quote,
          slug: prevRow.article_slug ?? null,
          top: prevTally.top,
          pct: prevTally.top ? prevPct[prevTally.top] : 0,
        });
      }
    })().catch(() => {
      // Reactions unavailable. The card still reads fine without the tally.
    });

    return () => {
      cancelled = true;
    };
  }, [dateChecked, todayKey]);

  // ── Resolve the clip ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!view) return;

    // Curated rows normally carry their own URL, so no search is needed.
    if (view.videoUrl) {
      setVideoUrl(view.videoUrl);
      setClipState("ready");
      return;
    }

    let cancelled = false;
    setClipState("searching");
    fetch(`/api/yt-search?q=${encodeURIComponent(view.lead)}`)
      .then((r) => (r.ok ? r.json() : { embedUrl: null, duration: null }))
      .then((d: { embedUrl: string | null; duration: string | null }) => {
        if (cancelled) return;
        if (d?.embedUrl) {
          setVideoUrl(d.embedUrl);
          setDuration(d?.duration ?? null);
          setClipState("ready");
        } else {
          setClipState("none");
        }
      })
      .catch(() => {
        if (!cancelled) setClipState("none");
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  // ── Hover preview ───────────────────────────────────────────────────────────
  // Gated three ways: a real pointer (so touch never triggers it on tap), a
  // resolved clip, and prefers-reduced-motion. The short delay stops a preview
  // loading when the cursor merely crosses the card on its way somewhere else.
  const startPreview = useCallback(() => {
    if (clipState !== "ready" || !videoUrl) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewing(true), 220);
  }, [clipState, videoUrl]);

  const stopPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
    setPreviewing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  /** After voting inside the theater, bring the freshly revealed tally into view.
   *  On a laptop the video plus the panel is taller than the viewport, so without
   *  this the last row or two of the result sits below the fold. */
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dialogOpen || myReaction === null) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Waits out the 460ms grid reveal so the scroll targets its final height.
    const t = setTimeout(() => {
      revealRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "end",
      });
    }, 500);
    return () => clearTimeout(t);
  }, [dialogOpen, myReaction]);

  // The preview must not keep playing behind the fullscreen dialog.
  useEffect(() => {
    if (dialogOpen) {
      setPreviewing(false);
      setWatched(true);
    }
  }, [dialogOpen]);

  // ── Cast a reaction ─────────────────────────────────────────────────────────
  const react = useCallback(
    async (key: ReactionKey) => {
      if (myReaction !== null || pending) return;

      const supabase = supabaseRef.current;
      setPending(true);

      // Optimistic, then rolled back on failure. Same contract as DailyPoll.
      setMyReaction(key);
      setCounts((c) => ({ ...c, [key]: c[key] + 1 }));

      try {
        const next = advanceStreak(parseStreak(localStorage.getItem(STREAK_KEY)), todayKey);
        localStorage.setItem(STREAK_KEY, JSON.stringify(next));
        setStreak(next.count);
      } catch {
        // Storage blocked. The reaction itself still counts.
      }

      if (!supabase) {
        setPending(false);
        return;
      }

      const { error } = await supabase.from("reagimi_reactions").insert({
        reagimi_date: todayKey,
        reaction: key,
        voter_id: voterRef.current,
      });

      if (error) {
        // 23505 = the one-per-day unique index. That means this browser already
        // reacted today, so the optimistic state is right and only the count is
        // double-counted locally.
        if (error.code === "23505") {
          setCounts((c) => ({ ...c, [key]: Math.max(0, c[key] - 1) }));
        } else {
          setMyReaction(null);
          setCounts((c) => ({ ...c, [key]: Math.max(0, c[key] - 1) }));
        }
      }
      setPending(false);
    },
    [myReaction, pending, todayKey]
  );

  // ── Dialog: focus trap, focus restore, scroll lock, Escape ──────────────────
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDialogOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      // Only two focusables (close button, iframe), so a manual cycle is enough.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, iframe, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [dialogOpen]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const tally = useMemo(
    () => ({
      counts,
      total: REACTIONS.reduce((sum, r) => sum + counts[r.key], 0),
      top: null as ReactionKey | null,
    }),
    [counts]
  );
  const percentages = useMemo(() => reactionPercentages(tally), [tally]);

  const ytId = youtubeId(videoUrl);
  const thumbs = ytId ? thumbnailCandidates(ytId) : [];
  const thumbSrc = thumbs[thumbIndex] ?? null;

  const dateLabel = formatAlbanianDate(todayKey);

  const header = (
    <div className="reagimi-head">
      <span className="reagimi-dot" aria-hidden="true" />
      <span className="reagimi-kicker">Reagimi i Ditës</span>
      {dateLabel && <span className="reagimi-date">{dateLabel}</span>}
      {streak >= 2 && (
        <span className="reagimi-streak" title={`Ke reaguar ${streak} ditë radhazi`}>
          <Zap size={12} strokeWidth={2.5} aria-hidden="true" />
          {streak} ditë radhazi
        </span>
      )}
    </div>
  );

  // ── Waiting state ───────────────────────────────────────────────────────────
  // Nothing curated and nothing published today. Saying so is better than showing
  // a five-day-old article under a heading that promises daily.
  if (!view) {
    return (
      <section className="reagimi" aria-labelledby="reagimi-title">
        <div className="reagimi-card">
          {header}
          <div className="reagimi-waiting">
            <p className="reagimi-waiting-title" id="reagimi-title">
              Reagimi i sotëm nuk ka dalë ende
            </p>
            <p className="reagimi-waiting-sub">Kthehu më vonë gjatë ditës.</p>
          </div>
          {yesterday && <YesterdayRail data={yesterday} todayKey={todayKey} />}
        </div>
      </section>
    );
  }

  return (
    <section className="reagimi reagimi--enter" aria-labelledby="reagimi-title">
      <div className="reagimi-card">
        {header}

        <div className="reagimi-body">
          <div
            className="reagimi-media"
            onMouseEnter={startPreview}
            onMouseLeave={stopPreview}
          >
            {/* Muted looping preview, mounted only while hovered on a real pointer
                device. Nothing loads on page view, so the homepage LCP is untouched
                and mobile never spends data on a video nobody asked for. */}
            {previewing && ytId && (
              <iframe
                className="reagimi-preview"
                title=""
                aria-hidden="true"
                tabIndex={-1}
                src={`${embedUrl(ytId)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1&playsinline=1&rel=0&disablekb=1`}
                allow="autoplay; encrypted-media"
              />
            )}

            {thumbSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="reagimi-thumb"
                src={thumbSrc}
                alt=""
                loading="lazy"
                decoding="async"
                // maxresdefault is absent for many uploads; walk down to sddefault
                // then hqdefault rather than rendering YouTube's grey placeholder.
                onError={() => setThumbIndex((i) => Math.min(i + 1, thumbs.length - 1))}
              />
            ) : (
              <div className="reagimi-media-fallback" style={{ background: "#141414" }} />
            )}

            {clipState === "searching" && <span className="reagimi-skeleton" aria-hidden="true" />}

            {clipState === "ready" && videoUrl && (
              <button
                type="button"
                className="reagimi-play"
                onClick={() => setDialogOpen(true)}
                aria-label={`Luaj videon: ${view.lead}`}
              >
                <span className="reagimi-play-ring" aria-hidden="true">
                  <Play size={24} strokeWidth={0} fill="#fff" />
                </span>
              </button>
            )}

            {duration && clipState === "ready" && (
              <span className="reagimi-duration">{duration}</span>
            )}
          </div>

          <div className="reagimi-content">
            {view.contextLine && <span className="reagimi-context">{view.contextLine}</span>}

            <h2
              id="reagimi-title"
              className={`reagimi-lead${view.quoted ? " reagimi-lead--quote" : ""}`}
            >
              {view.quoted ? `“${view.lead}”` : view.lead}
            </h2>

            <p className="reagimi-attribution">
              <span className="reagimi-speaker">{view.attributionName}</span>
              {view.attributionRole && <span className="reagimi-role">{view.attributionRole}</span>}
            </p>

            {/* Watching is the primary action. The previous version's only call to
                action was "Lexo artikullin", which pointed people away from the very
                clip the module exists to surface. */}
            <div className="reagimi-actions">
              {clipState === "ready" && videoUrl && (
                <button
                  type="button"
                  className="reagimi-watch"
                  onClick={() => setDialogOpen(true)}
                >
                  <Play size={15} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                  Shiko videon
                  {duration && <span className="reagimi-watch-dur">{duration}</span>}
                </button>
              )}

              {view.articleSlug && (
                <Link className="reagimi-link" href={`/article/${view.articleSlug}`}>
                  Lexo artikullin
                  <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Reaction bar ── */}
        <div className={`reagimi-react${watched && !myReaction ? " reagimi-react--cue" : ""}`}>
          <div className="reagimi-react-head">
            <span className="reagimi-react-title">
              {myReaction
                ? "Kështu reagoi Kosova"
                : watched
                  ? "E pe. Si po reagon?"
                  : "Si po reagon ti?"}
            </span>
            <span className="reagimi-react-count">{reactionCountLabel(tally.total)}</span>
          </div>

          {myReaction === null ? (
            <div className="reagimi-options" role="group" aria-label="Si po reagon ti?">
              {REACTIONS.map((r) => {
                const Icon = ICONS[r.icon];
                return (
                  <button
                    key={r.key}
                    type="button"
                    className="reagimi-option"
                    onClick={() => react(r.key)}
                    disabled={pending}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="reagimi-results" aria-live="polite">
              {REACTIONS.map((r, i) => {
                const Icon = ICONS[r.icon];
                const mine = myReaction === r.key;
                const pct = percentages[r.key];
                return (
                  <div
                    key={r.key}
                    className={`reagimi-result${mine ? " reagimi-result--mine" : ""}`}
                  >
                    <span className="reagimi-result-icon" aria-hidden="true">
                      {mine ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <Icon size={14} strokeWidth={2} />
                      )}
                    </span>
                    <span className="reagimi-result-label">{r.label}</span>
                    <span className="reagimi-track">
                      <span
                        className="reagimi-fill"
                        style={
                          {
                            "--pct": barsArmed ? pct / 100 : 0,
                            "--reveal-delay": `${i * 40}ms`,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="reagimi-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {yesterday && <YesterdayRail data={yesterday} todayKey={todayKey} />}
      </div>

      {dialogOpen && videoUrl && portalTarget && createPortal(
        <div
          className="reagimi-dialog-backdrop"
          onClick={() => setDialogOpen(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            className="reagimi-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Video: ${view.lead}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              className="reagimi-dialog-close"
              onClick={() => setDialogOpen(false)}
            >
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
              Mbyll
            </button>

            <div className="reagimi-dialog-stage">
              <iframe
                title={`Video: ${view.lead}`}
                src={`${ytId ? embedUrl(ytId) : videoUrl}?autoplay=1&rel=0`}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            </div>

            {/* Nothing but the clip and the five reactions until a vote is cast.
                The tally and yesterday's result then unfold beneath, so the
                sequence is watch, decide, compare. */}
            <div className="reagimi-dialog-panel">
              {myReaction === null ? (
                <>
                  <p className="reagimi-dialog-prompt">Si po reagon ti?</p>
                  <div className="reagimi-options" role="group" aria-label="Si po reagon ti?">
                    {REACTIONS.map((r) => {
                      const Icon = ICONS[r.icon];
                      return (
                        <button
                          key={r.key}
                          type="button"
                          className="reagimi-option"
                          onClick={() => react(r.key)}
                          disabled={pending}
                        >
                          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="reagimi-dialog-prompt">Kështu reagoi Kosova</p>
              )}

              {/* grid-template-rows 0fr -> 1fr is the one CSS-only way to animate
                  to a height nobody has measured, so the reveal stays smooth for
                  any number of rows. */}
              <div
                ref={revealRef}
                className={`reagimi-reveal${myReaction !== null ? " reagimi-reveal--open" : ""}`}
                aria-hidden={myReaction === null}
              >
                <div className="reagimi-reveal-inner">
                  <div className="reagimi-results" aria-live="polite">
                    {REACTIONS.map((r, i) => {
                      const Icon = ICONS[r.icon];
                      const mine = myReaction === r.key;
                      const pct = percentages[r.key];
                      return (
                        <div
                          key={r.key}
                          className={`reagimi-result${mine ? " reagimi-result--mine" : ""}`}
                        >
                          <span className="reagimi-result-icon" aria-hidden="true">
                            {mine ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2} />}
                          </span>
                          <span className="reagimi-result-label">{r.label}</span>
                          <span className="reagimi-track">
                            <span
                              className="reagimi-fill"
                              style={
                                {
                                  "--pct": barsArmed ? pct / 100 : 0,
                                  "--reveal-delay": `${140 + i * 45}ms`,
                                } as React.CSSProperties
                              }
                            />
                          </span>
                          <span className="reagimi-pct">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="reagimi-dialog-count">{reactionCountLabel(tally.total)}</p>

                  {yesterday && (
                    <div className="reagimi-dialog-rail">
                      <span className="reagimi-rail-day">
                        {relativeDayLabel(yesterday.dateKey, todayKey)}
                      </span>
                      <span className="reagimi-rail-quote">{yesterday.lead}</span>
                      {yesterday.top && (
                        <span className="reagimi-rail-verdict">
                          {yesterday.pct}% {reactionLabel(yesterday.top)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        portalTarget
      )}
    </section>
  );
}

/** Yesterday's reaction and how it landed. This is the reason to come back. */
function YesterdayRail({
  data,
  todayKey,
}: {
  data: { dateKey: string; lead: string; slug: string | null; top: ReactionKey | null; pct: number };
  todayKey: string;
}) {
  const body = (
    <>
      <span className="reagimi-rail-day">{relativeDayLabel(data.dateKey, todayKey)}</span>
      <span className="reagimi-rail-quote">{data.lead}</span>
      {data.top && (
        <span className="reagimi-rail-verdict">
          {data.pct}% {reactionLabel(data.top)}
        </span>
      )}
    </>
  );

  if (!data.slug) return <div className="reagimi-rail">{body}</div>;

  return (
    <Link className="reagimi-rail" href={`/article/${data.slug}`}>
      {body}
    </Link>
  );
}
