'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type Article } from '@/lib/mock-data'
import { getCategoryColor } from '@/lib/category-colors'
import { FONT } from '@/lib/tokens'

export interface AccordionSlide {
  article: Article
  category: string
  label: string
}

interface Props {
  slides: AccordionSlide[]
}

export default function ImageAccordion({ slides }: Props) {
  const [active, setActive] = useState(0)

  return (
    <section
      aria-label="Lajmet kryesore sipas kategorisë"
      style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        height: 'clamp(460px, 62vh, 660px)',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {slides.map((slide, i) => {
        const isActive = i === active
        const catColor = getCategoryColor(slide.category)
        const bgImage = slide.article.imageUrl
          ? `url("${slide.article.imageUrl}")`
          : undefined

        return (
          <div
            key={slide.article.id ?? i}
            role="button"
            tabIndex={0}
            aria-label={`${slide.label}: ${slide.article.title}`}
            aria-expanded={isActive}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActive(i) }}
            style={{
              flex: isActive ? 5 : 1,
              transition: 'flex 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden',
              cursor: isActive ? 'default' : 'pointer',
              background: '#111',
              backgroundImage: bgImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minWidth: 0,
              outline: 'none',
            }}
          >
            {/* Dark overlay — deeper gradient on active */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: isActive
                  ? 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%)'
                  : 'rgba(0,0,0,0.58)',
                transition: 'background 0.55s ease',
              }}
            />

            {/* Active: accent bar at top */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: catColor,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.4s ease',
                zIndex: 3,
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
                transition: 'opacity 0.25s ease',
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
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.88)',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
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
                padding: 'clamp(28px, 3.5vw, 48px)',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.38s ease 0.22s, transform 0.38s ease 0.22s',
                pointerEvents: isActive ? 'auto' : 'none',
                zIndex: 2,
              }}
            >
              {/* Category pill */}
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: catColor,
                  background: `${catColor}25`,
                  border: `1.5px solid ${catColor}60`,
                  padding: '4px 12px',
                  borderRadius: '100px',
                  marginBottom: '14px',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {slide.label}
              </span>

              {/* Title */}
              <h2
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 'clamp(18px, 2vw, 30px)',
                  fontWeight: 700,
                  lineHeight: 1.18,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                  margin: '0 0 10px',
                  maxWidth: '460px',
                  textShadow: '0 2px 16px rgba(0,0,0,0.55)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {slide.article.title}
              </h2>

              {/* Excerpt */}
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: 1.65,
                  color: 'rgba(255,255,255,0.68)',
                  margin: '0 0 22px',
                  maxWidth: '400px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {slide.article.excerpt}
              </p>

              {/* CTA */}
              <Link
                href={`/article/${slide.article.slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  background: catColor,
                  padding: '10px 20px',
                  borderRadius: '100px',
                  textDecoration: 'none',
                  boxShadow: `0 4px 20px ${catColor}50`,
                }}
              >
                Lexo lajmin
                <ArrowRight size={12} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        )
      })}

      <style>{`
        @media (max-width: 640px) {
          .img-accordion-section {
            height: clamp(520px, 80vh, 640px) !important;
            flex-direction: column !important;
          }
        }
      `}</style>
    </section>
  )
}
