'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type Article } from '@/lib/mock-data'
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
      aria-label="Pesë lajme të zgjedhura"
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        background: 'transparent',
        height: 'clamp(380px, 42vw, 460px)',
        overflow: 'hidden',
      }}
    >
      <div
        className="feature-accordion-track"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          gap: '12px',
          padding: 0,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          alignItems: 'stretch',
        }}
        onMouseLeave={() => canHover && setActive(0)}
      >
        {slides.map((slide, i) => {
          const isActive = active === i
          const catColor = getCategoryColor(slide.category)
          const bgImage = slide.article.imageUrl
            ? `url("${slide.article.imageUrl}")`
            : undefined

          return (
            <div
              className="feature-accordion-card"
              key={slide.article.id ?? i}
              role="button"
              tabIndex={0}
              aria-label={`${slide.label}: ${slide.article.title}`}
              aria-expanded={isActive}
              onMouseEnter={() => canHover && setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(-1)}
              onClick={() => !canHover && setActive(isActive ? -1 : i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActive(i)
              }}
              style={{
                flex: isActive ? 2.35 : 1,
                transition: 'flex 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                background: bgImage ? '#1a1a1a' : '#F0EDE8',
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '16px',
                minWidth: 0,
                outline: 'none',
                boxShadow: '0 2px 12px rgba(17,17,17,0.08)',
              }}
            >
              {/* Dark overlay */}
              <div
                className="feature-accordion-overlay"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: isActive
                    ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.06) 100%)'
                    : 'rgba(0,0,0,0.48)',
                  transition: 'background 0.45s ease',
                }}
              />

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
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.35s ease',
                  zIndex: 3,
                  borderRadius: '16px 16px 0 0',
                }}
              />

              {/* Collapsed: vertical label */}
              <div
                className="feature-accordion-vertical-label"
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
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.92)',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                  }}
                >
                  {slide.label}
                </span>
              </div>

              {/* Expanded: article content */}
              <div
                className="feature-accordion-content"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 'clamp(18px, 2vw, 28px)',
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
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: catColor,
                    background: `${catColor}22`,
                    border: `1.5px solid ${catColor}50`,
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
                    fontSize: 'clamp(18px, 1.75vw, 26px)',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: '#FFFFFF',
                    margin: '0 0 6px',
                    maxWidth: '420px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    background: catColor,
                    padding: '6px 12px',
                    borderRadius: '100px',
                    textDecoration: 'none',
                    boxShadow: `0 3px 14px ${catColor}45`,
                  }}
                >
                  Lexo lajmin
                  <ArrowRight size={10} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .feature-accordion {
            height: 312px !important;
            overflow: visible !important;
          }
          .feature-accordion-track {
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
            height: 300px !important;
            scroll-snap-align: start;
          }
          .feature-accordion-overlay {
            background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.28) 62%, rgba(0,0,0,0.08) 100%) !important;
          }
          .feature-accordion-topbar {
            opacity: 1 !important;
          }
          .feature-accordion-vertical-label {
            display: none !important;
          }
          .feature-accordion-content {
            opacity: 1 !important;
            transform: none !important;
            pointer-events: auto !important;
            padding: 20px !important;
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
