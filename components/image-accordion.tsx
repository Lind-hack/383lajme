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
        <h2
          id="feature-accordion-title"
          style={{
            margin: 0,
            color: '#111111',
            fontSize: 'clamp(22px, 2vw, 28px)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
            textWrap: 'balance',
          }}
        >
          5 tema, 5 lajme
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: '65ch',
            color: '#5F5B56',
            fontSize: '15px',
            lineHeight: 1.55,
            textWrap: 'pretty',
          }}
        >
          Një lajm kryesor nga secila prej pesë temave kryesore të faqes.
        </p>
      </header>

      <div
        className="feature-accordion-track"
        style={{
          width: '100%',
          height: 'clamp(380px, 38vw, 430px)',
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
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '16px',
                minWidth: 0,
                outline: 'none',
                boxShadow: '0 2px 12px rgba(17,17,17,0.08)',
                textDecoration: 'none',
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
                    : 'linear-gradient(to top, rgba(0,0,0,0.84) 0%, rgba(0,0,0,0.22) 66%, rgba(0,0,0,0.12) 100%)',
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
                    fontSize: isActive ? 'clamp(20px, 1.7vw, 26px)' : '15px',
                    fontWeight: 700,
                    lineHeight: isActive ? 1.2 : 1.3,
                    color: '#FFFFFF',
                    margin: `0 0 ${isActive ? '12px' : '0'}`,
                    maxWidth: '420px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    display: '-webkit-box',
                    WebkitLineClamp: isActive ? 3 : 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {slide.article.title}
                </h3>

                <span
                  className="feature-accordion-cta"
                  style={{
                    display: isActive ? 'inline-flex' : 'none',
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
                    boxShadow: `0 3px 14px ${catColor}45`,
                  }}
                >
                  Lexo lajmin
                  <ArrowRight size={10} strokeWidth={2.5} />
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
            height: 312px !important;
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
          .feature-accordion-topic {
            top: 16px !important;
            left: 16px !important;
          }
          .feature-accordion-content {
            padding: 20px !important;
          }
          .feature-accordion-title {
            font-size: 20px !important;
            line-height: 1.22 !important;
            margin-bottom: 12px !important;
            -webkit-line-clamp: 3 !important;
          }
          .feature-accordion-cta {
            display: inline-flex !important;
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
