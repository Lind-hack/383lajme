import Link from "next/link";

/**
 * "Kalo te": the categories, one tap away.
 *
 * Each pill opens the category's own page, where the whole section is — not a
 * spot further down this one, which only ever held a handful of its stories.
 */
export default function SectionJump({ links }: { links: { href: string; label: string; color?: string }[] }) {
  if (links.length < 2) return null;
  return (
    <nav className="home-jump" aria-label="Kalo te kategoria">
      <span className="home-jump-label">Kalo te</span>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} style={link.color ? { ["--jump-color" as string]: link.color } : undefined}>
              {link.color && <i aria-hidden />}
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
