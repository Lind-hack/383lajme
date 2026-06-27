'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type Article, timeAgo } from '@/lib/mock-data'
import { getCategoryColor } from '@/lib/category-colors'
import { FONT } from '@/lib/tokens'

export interface AccordionSlide {
  article: Article
  category: string
  label: string
}

interface Props {
  featured: Article
  slides: AccordionSlide[]
}

export default function ImageAccordion({ featured, slides }: Props) {
  const [active, setActive] = useState(-1)

  const featuredColor = getCategoryColor(featured.category)

  return (
    <section
      className="split-hero"
      aria-label="Lajmi kryesor"
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'row',
        height: 'clamp(380px, 44vh, 480px)',
        overflow: 'hidden',
      }}
    >
      {/* Orange radial glow — top-right corner accent */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,68,34,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Left: featured article — text only ── */}
      <div
        className="split-hero-left"
        style={{
          flex: '0 0 48%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '28px clamp(20px, 3vw, 44px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Overline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#FF4422',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#FF4422',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(255,68,34,0.7)',
                animation: 'pulse-dot 2s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            LAJMI KRYESOR
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: featuredColor,
              background: `${featuredColor}15`,
              border: `1.5px solid ${featuredColor}40`,
              padding: '2px 8px',
              borderRadius: '100px',
            }}
          >
            {featured.category}
          </span>
        </div>

        {/* Age */}
        <span
          suppressHydrationWarning
          style={{
            display: 'block',
            fontSize: '10px',
            color: '#9C9C9C',
            fontWeight: 500,
            marginBottom: '8px',
          }}
        >
          {timeAgo(featured.publishedAt)}
        </span>

        {/* Headline */}
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: 'clamp(20px, 2.8vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#111111',
            margin: '0 0 10px',
          }}
        >
          {featured.title}
        </h2>

        {/* Excerpt */}
        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#6B6B6B',
            margin: '0 0 14px',
            fontWeight: 400,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {featured.excerpt}
        </p>

        {/* Meta + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#9C9C9C', fontWeight: 500 }}>
            {featured.readingTime ?? 3} min lexim
          </span>
          <div style={{ width: '1px', height: '12px', background: 'rgba(17,17,17,0.12)' }} />
          <span style={{ fontSize: '11px', color: '#9C9C9C', fontWeight: 500 }}>
            {featured.source}
          </span>
          <Link
            href={`/article/${featured.slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#ffffff',
              background: '#FF4422',
              padding: '8px 18px',
              borderRadius: '100px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              boxShadow: '0 4px 18px rgba(255,68,34,0.35)',
              marginLeft: 'auto',
            }}
          >
            Lexo lajmin
            <ArrowRight size={11} strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {/* ── Right: image accordion ── */}
      <div
        className="split-hero-right"
        style={{
          flex: 1,
          display: 'flex',
          gap: '6px',
          padding: '10px 14px',
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          alignItems: 'stretch',
        }}
        onMouseLeave={() => setActive(-1)}
      >
        {slides.map((slide, i) => {
          const isActive = active === i
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
              onFocus={() => setActive(i)}
              onBlur={() => setActive(-1)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActive(i)
              }}
              style={{
                flex: isActive ? 4.5 : 1,
                transition: 'flex 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                background: bgImage ? '#1a1a1a' : '#F0EDE8',
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '12px',
                minWidth: 0,
                outline: 'none',
                boxShadow: '0 2px 12px rgba(17,17,17,0.08)',
              }}
            >
              {/* Dark overlay */}
              <div
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
                    fontSize: '9px',
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
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 'clamp(12px, 1.5vw, 20px)',
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
                    fontSize: 'clamp(13px, 1.4vw, 20px)',
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
                    fontSize: '9px',
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
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(255,68,34,0.8); }
          50%       { opacity: 0.45; box-shadow: 0 0 4px rgba(255,68,34,0.3); }
        }
        @media (max-width: 900px) {
          .split-hero { flex-direction: column !important; height: auto !important; }
          .split-hero-left { flex: 0 0 auto !important; }
          .split-hero-right { height: 200px; padding: 10px !important; }
        }
      `}</style>
    </section>
  )
}
