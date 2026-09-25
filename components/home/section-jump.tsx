/**
 * "Kalo te": one row of links to the homepage's news sections.
 *
 * The page carries a dozen sections between modules, and a reader looking for
 * Sport had no way to it but scrolling past everything above. Only sections
 * that actually rendered are listed, so a link never lands on nothing.
 */
export default function SectionJump({ links }: { links: { id: string; label: string; color?: string }[] }) {
  if (links.length < 2) return null;
  return (
    <nav className="home-jump" aria-label="Kalo te seksioni">
      <span className="home-jump-label">Kalo te</span>
      <ul>
        {links.map((link) => (
          <li key={link.id}>
            <a href={`#${link.id}`} style={link.color ? { ["--jump-color" as string]: link.color } : undefined}>
              {link.color && <i aria-hidden />}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
