'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type Article, calcReadingTime } from '@/lib/mock-data'
import TimeAgo from './time-ago'
import { getCategoryColor } from '@/lib/category-colors'
import { FONT } from '@/lib/tokens'
import { useCanHover } from '@/hooks/use-can-hover'

export interface AccordionSlide {
  article: Article
  category: string
  label: string
}

interface Props {
  slides: AccordionSlide[]
}

export default function ImageAccordion({ slides }: Props) {
  const canHover = useCanHover()
  const [active, setActive] = useState(0)

  return (
    <section
      className="feature-accordion"
      aria-labelledby="feature-accordion-title"
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        background: 'transparent',
      }}
    >
      <header
        className="feature-accordion-heading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
          marginBottom: '20px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            color: '#FF4422',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF4422' }} />
          Sot në 383
        </span>
        <h2
          id="feature-accordion-title"
          style={{
            margin: 0,
            color: '#111111',
            fontSize: 'clamp(26px, 2.6vw, 36px)',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.032em',
            textWrap: 'balance',
          }}
        >
          5 tema, 5 lajme
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: '58ch',
            color: '#5F5B56',
            fontSize: '15.5px',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          Nëse lexon vetëm pesë gjëra sot, lexo këto — një histori e vetme nga secila temë.
        </p>
      </header>

      <div
        className="feature-accordion-track"
        style={{
          width: '100%',
          height: 'clamp(400px, 41vw, 470px)',
          display: 'flex',
          gap: '12px',
          padding: 0,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
        onMouseLeave={() => canHover && setActive(0)}
      >
        {slides.map((slide, i) => {
          const isActive = active === i
          const catColor = getCategoryColor(slide.category)
          const bgImage = slide.article.imageUrl
            ? `url("${slide.article.imageUrl}")`
            : undefined
          const readMins = calcReadingTime(slide.article.body)

          return (
            <Link
              className="feature-accordion-card"
              key={slide.article.id ?? i}
              href={`/article/${slide.article.slug}`}
              aria-label={`${slide.label}: ${slide.article.title}`}
              onMouseEnter={() => canHover && setActive(i)}
              onFocus={() => setActive(i)}
              style={{
                flex: isActive ? 2.25 : 1,
                transition: 'flex 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'block',
                background: bgImage ? '#1a1a1a' : '#F0EDE8',
                borderRadius: '16px',
                minWidth: 0,
                outline: 'none',
                boxShadow: isActive
                  ? '0 18px 44px rgba(17,17,17,0.20)'
                  : '0 2px 12px rgba(17,17,17,0.08)',
                textDecoration: 'none',
              }}
            >
              {/* Media sits on its own layer so the open card can drift in. */}
              <div
                className="feature-accordion-media"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: bgImage,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />

              {/* Dark overlay — heavier at the foot so headlines stay legible. */}
              <div
                className="feature-accordion-overlay"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: isActive
                    ? 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.62) 32%, rgba(0,0,0,0.16) 70%, rgba(0,0,0,0.04) 100%)'
                    : 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.48) 42%, rgba(0,0,0,0.14) 78%, rgba(0,0,0,0.08) 100%)',
                  transition: 'background 0.45s ease',
                }}
              />

              {/* Rank — turns five cards into a countable list worth finishing. */}
              <span
                className="feature-accordion-rank"
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  zIndex: 2,
                  color: 'rgba(255,255,255,0.28)',
                  fontFamily: FONT.serif,
                  fontSize: isActive ? '54px' : '34px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  transition: 'font-size 0.45s cubic-bezier(0.22, 1, 0.36, 1), color 0.45s ease',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Category color top bar */}
              <div
                className="feature-accordion-topbar"
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: catColor,
                  opacity: 1,
                  zIndex: 3,
                  borderRadius: '16px 16px 0 0',
                }}
              />

              {/* Topic stays horizontal and readable in every card state. */}
              <span
                className="feature-accordion-topic"
                style={{
                  position: 'absolute',
                  top: '18px',
                  left: '18px',
                  zIndex: 2,
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                  paddingBottom: '5px',
                  borderBottom: `2px solid ${catColor}`,
                }}
              >
                {slide.label}
              </span>

              {/* Every card names its story; the active card adds a stronger CTA. */}
              <div
                className="feature-accordion-content"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: isActive ? 'clamp(20px, 2vw, 28px)' : '18px',
                  zIndex: 2,
                }}
              >
                <h3
                  className="feature-accordion-title"
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: isActive ? 'clamp(24px, 2.1vw, 32px)' : '17px',
                    fontWeight: 700,
                    lineHeight: isActive ? 1.14 : 1.26,
                    letterSpacing: isActive ? '-0.02em' : '-0.01em',
                    color: '#FFFFFF',
                    margin: `0 0 ${isActive ? '14px' : '10px'}`,
                    maxWidth: '480px',
                    textWrap: 'balance',
                    textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                    display: '-webkit-box',
                    WebkitLineClamp: isActive ? 3 : 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    transition: 'font-size 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {slide.article.title}
                </h3>

                {/* Byline gives the closed cards a reason to be read too. */}
                <div
                  className="feature-accordion-meta"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    marginBottom: isActive ? '14px' : '0',
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textShadow: '0 1px 6px rgba(0,0,0,0.7)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slide.article.source}
                  </span>
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  <TimeAgo iso={slide.article.publishedAt} />
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  <span>{readMins} min</span>
                </div>

                <span
                  className="feature-accordion-cta"
                  style={{
                    display: isActive ? 'inline-flex' : 'none',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    background: catColor,
                    padding: '8px 15px',
                    borderRadius: '100px',
                    boxShadow: `0 4px 18px ${catColor}55`,
                  }}
                >
                  Lexo lajmin
                  <ArrowRight size={11} strokeWidth={2.5} />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .feature-accordion {
            overflow: visible !important;
          }
          .feature-accordion-track {
            height: 348px !important;
            gap: 16px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 0 0 12px !important;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
          }
          .feature-accordion-track::-webkit-scrollbar {
            display: none;
          }
          .feature-accordion-card {
            flex: 0 0 min(82vw, 390px) !important;
            height: 336px !important;
            scroll-snap-align: start;
          }
          .feature-accordion-media {
            transform: none !important;
          }
          .feature-accordion-overlay {
            background: linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.58) 38%, rgba(0,0,0,0.14) 76%, rgba(0,0,0,0.06) 100%) !important;
          }
          .feature-accordion-rank {
            font-size: 40px !important;
          }
          .feature-accordion-meta {
            margin-bottom: 14px !important;
          }
          .feature-accordion-topbar {
            opacity: 1 !important;
          }
          .feature-accordion-topic {
            top: 16px !important;
            left: 16px !important;
          }
          .feature-accordion-content {
            padding: 20px !important;
          }
          .feature-accordion-title {
            font-size: 22px !important;
            line-height: 1.18 !important;
            margin-bottom: 10px !important;
            -webkit-line-clamp: 3 !important;
          }
          .feature-accordion-cta {
            display: inline-flex !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .feature-accordion-card,
          .feature-accordion-media,
          .feature-accordion-title,
          .feature-accordion-rank,
          .feature-accordion-overlay {
            transition-duration: 0.01ms !important;
          }
        }
        @media (max-width: 520px) {
          .feature-accordion-card {
            flex-basis: 86vw !important;
          }
        }
      `}</style>
    </section>
  )
}
