'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getCategoryColor, getCategoryGradient } from '@/lib/category-colors'
import { FONT } from '@/lib/tokens'
import type { AccordionSlide } from '@/components/image-accordion'

interface Props {
  slides: AccordionSlide[]
}

const CYCLE_MS = 5000

/**
 * No-image variant of the homepage accordion, placed at the bottom of the
 * article body. Desktop = hover to expand. Mobile / touch (no hover) =
 * auto-cycle one card "big" every 5s, looping 1→…→n→1 forever.
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function CategoryAccordion({ slides }: Props) {
  const [active, setActive] = useState(0)
  const [isTouch, setIsTouch] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Auto-cycle on phones: either a no-hover/touch device OR a narrow viewport
  // (a hover-incapable user can't trigger the desktop expand). React to changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const noHover = window.matchMedia('(hover: none), (pointer: coarse)')
    const narrow = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsTouch(noHover.matches || narrow.matches)
    apply()
    noHover.addEventListener('change', apply)
    narrow.addEventListener('change', apply)
    return () => {
      noHover.removeEventListener('change', apply)
      narrow.removeEventListener('change', apply)
    }
  }, [])

  // Pause the auto-cycle when the accordion scrolls off-screen or the tab is hidden.
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return

    const observedRef = { current: true }
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible' && observedRef.current)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        observedRef.current = entry.isIntersecting
        setIsVisible(entry.isIntersecting && document.visibilityState === 'visible')
      },
      { threshold: 0.1 }
    )
    observer.observe(containerRef.current)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // Auto-cycle on touch devices (respecting reduced-motion, visibility, and tab focus).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isTouch || !isVisible || prefersReducedMotion() || slides.length <= 1) return

    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setActive((i) => (i + 1) % slides.length)
      }, CYCLE_MS)
    }
    start()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isTouch, isVisible, slides.length])

  // Tapping a card on touch opens it and restarts the cycle from there.
  const handleTap = (i: number) => {
    if (!isTouch) return
    setActive(i)
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isVisible || prefersReducedMotion() || slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setActive((cur) => (cur + 1) % slides.length)
    }, CYCLE_MS)
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        gap: '6px',
        width: '100%',
        height: 'clamp(300px, 42vw, 360px)',
        alignItems: 'stretch',
      }}
      onMouseLeave={() => {
        if (!isTouch) setActive(-1)
      }}
    >
      {slides.map((slide, i) => {
        const isActive = active === i
        const catColor = getCategoryColor(slide.category)
        const [g1, g2] = getCategoryGradient(slide.category)

        return (
          <div
            key={slide.article.id ?? i}
            role="button"
            tabIndex={0}
            aria-label={`${slide.label}: ${slide.article.title}`}
            aria-expanded={isActive}
            onMouseEnter={() => {
              if (!isTouch) setActive(i)
            }}
            onFocus={() => {
              if (!isTouch) setActive(i)
            }}
            onClick={() => handleTap(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setActive(i)
              }
            }}
            style={{
              flex: isActive ? 4.5 : 1,
              transition: 'flex 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              background: `linear-gradient(160deg, ${g1} 0%, ${g2} 100%)`,
              borderRadius: '12px',
              minWidth: 0,
              outline: 'none',
              boxShadow: '0 2px 12px rgba(17,17,17,0.10)',
            }}
          >
            {/* Subtle darkening on collapsed cards so the active one pops */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: isActive ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.22)',
                transition: 'background 0.45s ease',
              }}
            />

            {/* Brighter category accent bar on top when active */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255,255,255,0.85)',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.35s ease',
                zIndex: 3,
                borderRadius: '12px 12px 0 0',
              }}
            />

            {/* Collapsed: vertical label */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isActive ? 0 : 1,
                transition: 'opacity 0.18s ease',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.95)',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                }}
              >
                {slide.label}
              </span>
            </div>

            {/* Expanded: article content */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 'clamp(14px, 1.6vw, 22px)',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 0.3s ease 0.2s, transform 0.3s ease 0.2s',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  background: 'rgba(255,255,255,0.22)',
                  border: '1.5px solid rgba(255,255,255,0.45)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  marginBottom: '8px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {slide.label}
              </span>

              <h3
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 'clamp(15px, 1.5vw, 22px)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: '#FFFFFF',
                  margin: '0 0 10px',
                  maxWidth: '440px',
                  textShadow: '0 2px 10px rgba(0,0,0,0.35)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {slide.article.title}
              </h3>

              <Link
                href={`/article/${slide.article.slug}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: catColor,
                  background: '#FFFFFF',
                  padding: '7px 14px',
                  borderRadius: '100px',
                  textDecoration: 'none',
                  boxShadow: '0 3px 14px rgba(0,0,0,0.25)',
                }}
              >
                Lexo lajmin
                <ArrowRight size={11} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
