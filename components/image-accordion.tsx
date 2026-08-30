import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { type Article, calcReadingTime } from '@/lib/mock-data'
import TimeAgo from './time-ago'
import TopicCarousel from './topic-carousel'
import { getCategoryColor } from '@/lib/category-colors'
import { FONT, RADIUS, SHADOW } from '@/lib/tokens'
import DosjeChip from '@/components/dosje-chip'

export interface AccordionSlide {
  article: Article
  /** The article's real category — never the slot we hoped to fill. */
  category: string
  label: string
}

interface Props {
  slides: AccordionSlide[]
}

/**
 * "5 tema, 5 lajme" — one story per topic.
 *
 * This was a hover accordion: one card expanded to flex 2.25 while the other
 * four compressed to ~165px, which left ~130px of text for a 17px serif
 * headline — two or three words a line. Four of the five headlines were only
 * ever readable by hovering them one at a time, on a module whose entire
 * promise is five stories at a glance. Mobile already rendered all five at
 * equal width; the desktop expand was the deviation, so it is gone.
 *
 * Equal widths mean no active card, so no client state, no hover gating, and
 * no !important block fighting the inline styles. Hover is decoration now —
 * image drift and a shadow lift, both composited — so this renders on the
 * server.
 */
export default function ImageAccordion({ slides }: Props) {
  return (
    <section
      className="feature-grid"
      aria-labelledby="feature-grid-title"
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        background: 'transparent',
      }}
    >
      <header
        className="feature-grid-heading"
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
          id="feature-grid-title"
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

      <TopicCarousel>
        {slides.map((slide, i) => {
          const catColor = getCategoryColor(slide.category)
          const bgImage = slide.article.imageUrl
            ? `url("${slide.article.imageUrl}")`
            : undefined
          const readMins = calcReadingTime(slide.article.body)

          return (
            <Link
              className="feature-grid-card"
              key={slide.article.id ?? i}
              href={`/article/${slide.article.slug}`}
              aria-label={`${slide.label}: ${slide.article.title}`}
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'block',
                height: 'clamp(360px, 34vw, 430px)',
                background: bgImage ? '#1a1a1a' : '#F0EDE8',
                borderRadius: `${RADIUS.md}px`,
                minWidth: 0,
                boxShadow: SHADOW.card,
                textDecoration: 'none',
                // No inline `outline: none` here on purpose: an inline style
                // beats the stylesheet regardless of specificity, so it would
                // silently defeat the :focus-visible ring defined below.
              }}
            >
              {/* Media on its own layer so the hover drift stays composited. */}
              <div
                className="feature-grid-media"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: bgImage,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />

              {/* Heavier at the foot so the headline stays legible over photos. */}
              <div
                className="feature-grid-overlay"
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.62) 38%, rgba(0,0,0,0.16) 74%, rgba(0,0,0,0.05) 100%)',
                }}
              />

              {/* Position in the set, not a ranking — the five are peers. */}
              <span
                className="feature-grid-rank"
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '16px',
                  zIndex: 2,
                  color: 'rgba(255,255,255,0.26)',
                  fontFamily: FONT.serif,
                  fontSize: '34px',
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              <div
                className="feature-grid-topbar"
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: catColor,
                  zIndex: 3,
                  borderRadius: `${RADIUS.md}px ${RADIUS.md}px 0 0`,
                }}
              />

              {/* The topic is what distinguishes these five from any other row
                  of cards on the homepage, so it reads before the headline. */}
              <span
                className="feature-grid-topic"
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

              <div
                className="feature-grid-content"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '20px',
                  zIndex: 2,
                }}
              >
                <DosjeChip article={slide.article} dark compact />

                <h3
                  className="feature-grid-title"
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: '19px',
                    fontWeight: 700,
                    lineHeight: 1.22,
                    letterSpacing: '-0.01em',
                    color: '#FFFFFF',
                    margin: '0 0 10px',
                    textWrap: 'balance',
                    textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                    display: '-webkit-box',
                    // Six lines clears the longest headlines these feeds
                    // produce at this column width; four still truncated most
                    // of them, which was the whole complaint about the old
                    // collapsed cards.
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {slide.article.title}
                </h3>

                <div
                  className="feature-grid-meta"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    marginBottom: '14px',
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

                {/* On every card, because every card is a link. Showing this on
                    the hovered one alone implied the other four were inert. */}
                <span
                  className="feature-grid-cta"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    background: catColor,
                    padding: '8px 15px',
                    borderRadius: `${RADIUS.pill}px`,
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
      </TopicCarousel>

      <style>{`
        .feature-grid-card {
          transition: box-shadow 300ms cubic-bezier(0.22, 1, 0.36, 1),
                      transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .feature-grid-media {
          transform: scale(1);
          transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        @media (hover: hover) and (pointer: fine) {
          .feature-grid-card:hover {
            box-shadow: ${SHADOW.hover};
            transform: translateY(-3px);
          }
          .feature-grid-card:hover .feature-grid-media {
            transform: scale(1.05);
          }
        }
        /* The old card set outline:none with nothing in its place, so keyboard
           users had no focus indicator at all (WCAG 2.4.7). */
        .feature-grid-card:focus-visible {
          outline: 3px solid #FF4422;
          outline-offset: 3px;
        }

        /* Below the five-up breakpoint one card owns the full width (see
           TopicCarousel), so it can afford to be taller and the headline can
           grow instead of being clamped into a narrow column. Three- and
           two-column stages used to sit here; at ~230px they put a six-line
           headline over the photo and the card became unreadable. */
        @media (max-width: 1100px) {
          .feature-grid-card {
            height: clamp(400px, 74vw, 470px) !important;
          }
          .feature-grid-title {
            font-size: 25px !important;
            line-height: 1.16 !important;
            -webkit-line-clamp: 4 !important;
          }
          /* The arrows are vertically centred and reach 28px into the card, which
             is the same band the headline occupies. Text is inset past that with
             margin to spare, so a wide first letter can never touch the button.
             !important because the element carries an inline padding, and an
             inline style wins over a stylesheet rule at any specificity. */
          .feature-grid-content {
            padding: 24px 36px !important;
          }
          .feature-grid-topic {
            left: 36px !important;
          }
        }
        @media (max-width: 520px) {
          .feature-grid-title {
            font-size: 22px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .feature-grid-card,
          .feature-grid-media {
            transition: none !important;
          }
          .feature-grid-card:hover {
            transform: none !important;
          }
          .feature-grid-card:hover .feature-grid-media {
            transform: scale(1) !important;
          }
        }
      `}</style>
    </section>
  )
}
