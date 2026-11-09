import type { ArticleFigures as Figures } from "@/lib/mock-data";

// Formatted by hand, not Intl: the server's and the browser's locale data can differ by a
// space, and a mismatch there breaks hydration of the whole article.
function number(value: number) {
  // 70 000 000 000 reads as "70 mld": shortened only when nothing is rounded away.
  for (const [size, word] of [[1e9, " mld"], [1e6, " mln"]] as const) {
    const scaled = value / size;
    if (scaled >= 1 && Number.isInteger(Math.round(scaled * 1e4) / 100)) return `${grouped(Math.round(scaled * 100) / 100)}${word}`;
  }
  return grouped(value);
}

function grouped(value: number) {
  const [whole, part] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${part ? `,${part}` : ""}`;
}

function shown(value: number, unit: string) {
  if (!unit) return number(value);
  return unit === "%" ? `${number(value)}%` : `${number(value)} ${unit}`;
}

/**
 * The story's own numbers side by side: votes, a score, prices before and after. Bars share
 * one scale from zero so their lengths compare honestly; the largest is drawn in the accent,
 * and every value is written out, so the chart never rests on length or colour alone.
 */
export default function ArticleFigures({ figures }: { figures: Figures }) {
  const high = Math.max(...figures.items.map((i) => i.value)) || 1;
  const summary = `${figures.title}: ${figures.items.map((i) => `${i.label} ${shown(i.value, figures.unit)}`).join(", ")}.`;
  return (
    <figure className="ctx-figures" aria-label={summary}>
      <figcaption className="ctx-figures-title">{figures.title}</figcaption>
      <ul className="ctx-figures-list">
        {figures.items.map((item, i) => (
          <li key={i} className={`ctx-figures-row${item.value === high ? " ctx-figures-top" : ""}`}>
            <span className="ctx-figures-label">{item.label}</span>
            <span className="ctx-figures-track">
              <span className="ctx-figures-bar" style={{ width: `${(item.value / high) * 78}%` }} aria-hidden="true" />
              <span className="ctx-figures-value">{shown(item.value, figures.unit)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
