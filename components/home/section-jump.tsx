import Link from "next/link";
import CategoryMark from "@/components/category-mark";

/**
 * "Kalo te": the categories, one tap away.
 *
 * Each tile opens the category's own page, where the whole section is — not a
 * spot further down this one, which only ever held a handful of its stories.
 * The marks are the ones the category row under the nav uses, so a section
 * looks the same wherever it is offered. All seven fit a 360px phone without
 * a swipe: the row is a seven-column grid there, icon over label.
 */
/** Names too long for a seventh of a phone; the tile's accessible name stays whole. */
const SHORT: Record<string, string> = { Teknologji: "Tekno" };

export default function SectionJump({ links }: { links: { href: string; label: string; color?: string }[] }) {
  if (links.length < 2) return null;
  return (
    <nav className="home-jump" aria-label="Kalo te kategoria">
      <span className="home-jump-label">Kalo te</span>
      <ul>
        {links.map((link) => {
          const short = SHORT[link.label];
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-label={link.label}
                style={link.color ? { ["--jump-color" as string]: link.color } : undefined}
              >
                <span className="home-jump-icon">
                  <CategoryMark category={link.label} size={17} />
                </span>
                <span className="home-jump-name" data-short={short ? "0" : undefined}>{link.label}</span>
                {short && <span className="home-jump-name" data-short="1">{short}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
