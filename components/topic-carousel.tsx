'use client'

import { Children, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * One-card-at-a-time rail for "5 tema, 5 lajme" below the desktop breakpoint.
 *
 * Five equal columns work at full width, but on an iPad or a phone the same grid
 * gives each card ~230px under a six-line headline, so the text block eats the
 * photo and nothing reads. Narrow viewports get a single card instead, stepped
 * with arrows.
 *
 * The track is a scroll-snap container rather than a transform, so a touch swipe
 * still works natively with real momentum — the arrows drive the same scroll
 * rather than a parallel state machine, which keeps the two input methods from
 * disagreeing about where the rail is.
 *
 * Only this wrapper is a client component; the cards themselves are passed in as
 * already-server-rendered children, so nothing about the card markup ships as JS.
 */
export default function TopicCarousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const [index, setIndex] = useState(0)
  const count = Children.count(children)

  const syncIndex = useCallback(() => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const el = trackRef.current
      if (!el) return
      const per = el.clientWidth
      if (per <= 0) return
      // Snapping settles on multiples of the track width; rounding keeps a
      // half-finished momentum scroll from reporting the wrong card.
      setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / per))))
    })
  }, [count])

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  const step = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.max(0, Math.min(count - 1, index + dir))
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: next * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
    setIndex(next)
  }

  // At the ends the button has nothing to do, so it goes rather than sitting
  // there greyed out — a disabled control still asks to be read.
  const atStart = index <= 0
  const atEnd = index >= count - 1

  return (
    <div className="topic-carousel" style={{ position: 'relative' }}>
      <div
        ref={trackRef}
        className="topic-carousel-track"
        onScroll={syncIndex}
        // The rail is a horizontally scrollable region of its own, so keyboard
        // users need to be able to reach and scroll it without a pointer.
        tabIndex={0}
        role="group"
        aria-label="Pesë temat e ditës"
      >
        {children}
      </div>

      {!atStart && (
        <button
          type="button"
          className="topic-carousel-nav topic-carousel-prev"
          onClick={() => step(-1)}
          aria-label="Lajmi i mëparshëm"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
      )}

      {!atEnd && (
        <button
          type="button"
          className="topic-carousel-nav topic-carousel-next"
          onClick={() => step(1)}
          aria-label="Lajmi tjetër"
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      )}

      <style>{`
        /* Desktop keeps the five-up grid; the rail and its arrows only exist
           below the point where five columns stop being readable. */
        .topic-carousel-track {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          width: 100%;
        }
        .topic-carousel-nav { display: none; }

        @media (max-width: 1100px) {
          .topic-carousel-track {
            display: flex;
            gap: 0;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            outline: none;
          }
          .topic-carousel-track::-webkit-scrollbar { display: none; }
          .topic-carousel-track:focus-visible {
            outline: 3px solid #FF4422;
            outline-offset: 3px;
            border-radius: 16px;
          }
          .topic-carousel-track > * {
            flex: 0 0 100%;
            scroll-snap-align: center;
            scroll-snap-stop: always;
          }

          .topic-carousel-nav {
            position: absolute;
            /* Not 50%: the headline block is anchored to the foot of the card
               and grows upward, so a centred arrow lands on top of the text on
               a phone-width card. 35% keeps the arrows over the photo at every
               size the rail is used at. */
            top: 35%;
            transform: translateY(-50%);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 46px;
            height: 46px;
            padding: 0;
            border-radius: 50%;
            border: 0.5px solid rgba(255,255,255,0.55);
            background: linear-gradient(145deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.07) 100%);
            backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
            -webkit-backdrop-filter: blur(40px) saturate(200%) brightness(1.08);
            box-shadow: 0 8px 28px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.9);
            color: #111111;
            cursor: pointer;
            transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .topic-carousel-prev { left: 10px; }
          .topic-carousel-next { right: 10px; }
          .topic-carousel-nav:active { transform: translateY(-50%) scale(0.94); }
          .topic-carousel-nav:focus-visible {
            outline: 3px solid #FF4422;
            outline-offset: 3px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .topic-carousel-track { scroll-behavior: auto; }
          .topic-carousel-nav { transition: none; }
          .topic-carousel-nav:active { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  )
}
