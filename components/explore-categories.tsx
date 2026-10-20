import Image from "next/image";
import Link from "next/link";
import { getCategoryColor } from "@/lib/category-colors";
import { CATEGORY_TO_SLUG, normalizeCategory } from "@/lib/category-map";
import type { AccordionSlide } from "@/components/image-accordion";

/**
 * "Eksploro sipas kategorisë" under an article: one card per section, each led
 * by that section's newest photograph.
 *
 * It replaces an accordion of flat colour panels whose labels ran sideways up
 * the narrow strips — readable only by tilting your head, and auto-cycling on
 * phones. Here every card is the same size, upright, and says what it is: the
 * section, its latest headline, and a way into the section. On a phone the row
 * scrolls sideways with snap points instead of shrinking six cards to slivers.
 */
export default function ExploreCategories({ slides }: { slides: AccordionSlide[] }) {
  if (!slides.length) return null;
  return (
    <>
      <ul className="xcat-row">
        {slides.map(({ article, category, label }) => {
          const href = `/kategori/${CATEGORY_TO_SLUG[normalizeCategory(category)]}`;
          return (
            <li key={category} className="xcat-item" style={{ ["--xcat" as string]: getCategoryColor(category) }}>
              <Link href={`/article/${article.slug}`} className="xcat-card">
                <span className="xcat-photo" aria-hidden="true">
                  {article.imageUrl && <Image src={article.imageUrl} alt="" fill sizes="(max-width: 760px) 72vw, 220px" quality={75} />}
                </span>
                <span className="xcat-label">
                  <span className="xcat-dot" aria-hidden="true" />
                  {label}
                </span>
                <span className="xcat-title">{article.title}</span>
              </Link>
              <Link href={href} className="xcat-more">
                Shiko {label}
                <span aria-hidden="true"> →</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <style>{`
        .xcat-row {
          list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px;
        }
        .xcat-item { display: grid; gap: 10px; min-width: 0; }
        .xcat-card {
          position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px;
          aspect-ratio: 4 / 5; padding: 14px; border-radius: 14px; overflow: hidden;
          background: #1C1916; color: #fff; text-decoration: none;
          box-shadow: 0 1px 2px rgba(17,17,17,.06), 0 12px 28px -18px rgba(17,17,17,.4);
        }
        .xcat-photo { position: absolute; inset: 0; }
        .xcat-photo img { object-fit: cover; transition: transform .5s cubic-bezier(.22,1,.36,1); }
        .xcat-card::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(10,8,6,.05) 30%, rgba(10,8,6,.55) 62%, rgba(10,8,6,.88) 100%);
        }
        .xcat-label, .xcat-title { position: relative; z-index: 1; }
        .xcat-label {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 9px; border-radius: 100px; background: rgba(255,255,255,.94); color: #111;
          font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
        }
        .xcat-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--xcat); }
        .xcat-title {
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
          font-size: 14.5px; font-weight: 750; line-height: 1.3; text-wrap: pretty;
        }
        .xcat-more {
          justify-self: start; font-size: 12.5px; font-weight: 700; color: #111; text-decoration: none;
          border-bottom: 1.5px solid var(--xcat); padding-bottom: 1px;
        }
        .xcat-card:focus-visible, .xcat-more:focus-visible { outline: 2px solid #FF4422; outline-offset: 3px; }
        @media (hover: hover) and (pointer: fine) {
          .xcat-card:hover .xcat-photo img { transform: scale(1.04); }
          .xcat-more:hover { border-bottom-width: 2.5px; }
        }
        @media (max-width: 1100px) {
          .xcat-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .xcat-card { aspect-ratio: 16 / 11; }
        }
        @media (max-width: 760px) {
          .xcat-row {
            display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12px;
            margin: 0 -24px; padding: 0 24px 6px; scroll-padding: 0 24px; scrollbar-width: none;
          }
          .xcat-row::-webkit-scrollbar { display: none; }
          .xcat-item { flex: 0 0 72%; scroll-snap-align: start; }
          .xcat-card { aspect-ratio: 4 / 5; }
        }
        @media (prefers-reduced-motion: reduce) { .xcat-photo img { transition: none; } }
      `}</style>
    </>
  );
}
