'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SplineScene } from './ui/spline-scene'
import { Spotlight } from './ui/spotlight'
import { type Article, timeAgo, calcReadingTime } from '@/lib/mock-data'
import { getCategoryColor } from '@/lib/category-colors'
import { FONT } from '@/lib/tokens'
import { useState, useEffect } from 'react'

interface Props {
  article: Article
}

export default function RobotHero({ article }: Props) {
  const catColor = getCategoryColor(article.category)
  const [age, setAge] = useState('')
  useEffect(() => { setAge(timeAgo(article.publishedAt)) }, [article.publishedAt])

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        minHeight: 'calc(100vh - var(--nav-h))',
        background: '#111111',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* Spotlight beam from top-left */}
      <Spotlight
        className="-top-40 left-0 md:left-40 md:-top-20"
        fill="#FF4422"
      />

      {/* Subtle grid texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      {/* Orange glow bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          right: '-40px',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,68,34,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
        className="robot-hero-inner"
      >
        {/* ── LEFT: Best article ───────────────────────────── */}
        <div
          style={{
            flex: '1 1 50%',
            padding: 'clamp(40px, 5vw, 80px) clamp(24px, 4vw, 64px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '0',
          }}
        >
          {/* Overline */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
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
                className="pulse-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#FF4422',
                  display: 'inline-block',
                  boxShadow: '0 0 8px rgba(255,68,34,0.8)',
                }}
              />
              LAJMI KRYESOr
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'white',
                background: `${catColor}30`,
                border: `1.5px solid ${catColor}50`,
                padding: '3px 10px',
                borderRadius: '100px',
                backdropFilter: 'blur(8px)',
              }}
            >
              {article.category}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 500,
              }}
              suppressHydrationWarning
            >
              {age}
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: FONT.serif,
              fontSize: 'clamp(26px, 3.2vw, 46px)',
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              margin: '0 0 20px',
              maxWidth: '520px',
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}
          >
            {article.title}
          </h2>

          {/* Excerpt */}
          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.65,
              color: 'rgba(255,255,255,0.62)',
              margin: '0 0 36px',
              maxWidth: '480px',
              fontWeight: 400,
            }}
          >
            {article.excerpt}
          </p>

          {/* Meta + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              {calcReadingTime(article.body)} min lexim
            </span>

            <div
              style={{
                width: '1px',
                height: '14px',
                background: 'rgba(255,255,255,0.15)',
              }}
            />

            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 500,
              }}
            >
              {article.source}
            </span>

            <Link
              href={`/article/${article.slug}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#ffffff',
                background: '#FF4422',
                padding: '11px 26px',
                borderRadius: '100px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: '0 4px 24px rgba(255,68,34,0.45)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                marginLeft: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,68,34,0.6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,68,34,0.45)'
              }}
            >
              Lexo lajmin
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>

          {/* Divider line at bottom */}
          <div
            style={{
              marginTop: '48px',
              height: '1px',
              background: 'linear-gradient(90deg, rgba(255,68,34,0.5) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)',
            }}
          />
          <p
            style={{
              marginTop: '16px',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.2)',
              fontWeight: 600,
            }}
          >
            383 · Lajme nga Kosova
          </p>
        </div>

        {/* ── RIGHT: 3D Robot ──────────────────────────────── */}
        <div
          style={{
            flex: '1 1 50%',
            position: 'relative',
            minHeight: '500px',
          }}
          className="robot-hero-right"
        >
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .robot-hero-inner {
            flex-direction: column !important;
          }
          .robot-hero-right {
            min-height: 380px !important;
            flex: 0 0 380px !important;
          }
        }
      `}</style>
    </section>
  )
}
