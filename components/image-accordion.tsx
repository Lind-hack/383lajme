'use client'

import { useState, useEffect } from 'react'
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
  const [active, setActive] = useState(0)
  const [age, setAge] = useState('')

  useEffect(() => {
    setAge(timeAgo(featured.publishedAt))
  }, [featured.publishedAt])

  const featuredColor = getCategoryColor(featured.category)

  return (
    <section
      className="split-hero"
      aria-label="Lajmi kryesor"
      style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        minHeight: 'calc(100vh - var(--nav-h))',
        background: '#111111',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* ── Left: featured article — text only ── */}
      <div
        className="split-hero-left"
        style={{
          flex: '0 0 38%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(40px, 5vw, 80px) clamp(24px, 4vw, 60px)',
          position: 'relative',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '-80px',
            left: '-80px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${featuredColor}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Overline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#FF4422',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#FF4422',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(255,68,34,0.8)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
            LAJMI KRYESOR
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'white',
              background: `${featuredColor}30`,
              border: `1.5px solid ${featuredColor}50`,
              padding: '3px 10px',
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
            fontSize: '11px',
            color: 'rgba(255,255,255,0.3)',
            fontWeight: 500,
            marginBottom: '16px',
          }}
        >
          {age}
        </span>

        {/* Headline */}
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: 'clamp(24px, 2.8vw, 42px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            margin: '0 0 18px',
            textShadow: '0 2px 20px rgba(0,0,0,0.5)',
          }}
        >
          {featured.title}
        </h2>

        {/* Excerpt */}
        <p
          style={{
            fontSize: '15px',
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.58)',
            margin: '0 0 32px',
            fontWeight: 400,
          }}
        >
          {featured.excerpt}
        </p>

        {/* Meta + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
            {featured.readingTime ?? 3} min lexim
          </span>
          <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.12)' }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
            {featured.source}
          </span>
          <Link
            href={`/article/${featured.slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 800,
              color: '#ffffff',
              background: '#FF4422',
              padding: '11px 24px',
              borderRadius: '100px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(255,68,34,0.4)',
              marginLeft: 'auto',
            }}
          >
            Lexo lajmin
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        </div>

        {/* Footer line */}
        <div
          style={{
            marginTop: '40px',
            height: '1px',
            background:
              'linear-gradient(90deg, rgba(255,68,34,0.4) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
          }}
        />
        <p
          style={{
            marginTop: '14px',
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.18)',
            fontWeight: 600,
          }}
        >
          383 · Lajme nga Kosova
        </p>
      </div>

      {/* ── Right: image accordion ── */}
      <div
        className="split-hero-right"
        style={{
          flex: 1,
          display: 'flex',
          gap: '10px',
          padding: '24px 28px',
          minWidth: 0,
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActive(i)
              }}
              style={{
                flex: isActive ? 5 : 1,
                transition: 'flex 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                cursor: isActive ? 'default' : 'pointer',
                background: '#1a1a1a',
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '16px',
                minWidth: 0,
                outline: 'none',
              }}
            >
              {/* Dark overlay */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: isActive
                    ? 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0.08) 100%)'
                    : 'rgba(0,0,0,0.58)',
                  transition: 'background 0.5s ease',
                }}
              />

              {/* Accent bar */}
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
                  borderRadius: '16px 16px 0 0',
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
                  transition: 'opacity 0.2s ease',
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
                    color: 'rgba(255,255,255,0.9)',
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
                  padding: 'clamp(20px, 2.5vw, 36px)',
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'translateY(0)' : 'translateY(18px)',
                  transition: 'opacity 0.35s ease 0.22s, transform 0.35s ease 0.22s',
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: catColor,
                    background: `${catColor}25`,
                    border: `1.5px solid ${catColor}55`,
                    padding: '4px 12px',
                    borderRadius: '100px',
                    marginBottom: '12px',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  {slide.label}
                </span>

                <h3
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: 'clamp(16px, 1.8vw, 26px)',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: '#FFFFFF',
                    margin: '0 0 10px',
                    maxWidth: '440px',
                    textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {slide.article.title}
                </h3>

                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.65)',
                    margin: '0 0 18px',
                    maxWidth: '380px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {slide.article.excerpt}
                </p>

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
                    padding: '9px 18px',
                    borderRadius: '100px',
                    textDecoration: 'none',
                    boxShadow: `0 4px 16px ${catColor}45`,
                  }}
                >
                  Lexo lajmin
                  <ArrowRight size={12} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(255,68,34,0.8); }
          50%       { opacity: 0.5; box-shadow: 0 0 4px rgba(255,68,34,0.3); }
        }
        @media (max-width: 900px) {
          .split-hero { flex-direction: column !important; min-height: auto !important; }
          .split-hero-left { flex: 0 0 auto !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
          .split-hero-right { height: 340px; padding: 16px !important; }
        }
      `}</style>
    </section>
  )
}
