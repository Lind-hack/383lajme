import { chartShape } from "@/lib/article-context.mjs";
import type { ArticleChart as Chart } from "@/lib/mock-data";

const WIDTH = 300;
const HEIGHT = 100;
const MONTHS = ["jan", "shk", "mar", "pri", "maj", "qer", "korr", "gush", "sht", "tet", "nën", "dhj"];
const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", CHF: "CHF", TRY: "₺", JPY: "¥", CNY: "¥", PTS: "pikë" };

// Formatted by hand, not Intl: the server's and the browser's locale data can differ by a
// space, and a mismatch there breaks hydration of the whole article.
function amount(value: number, unit: string) {
  const digits = value >= 1000 ? 0 : value >= 100 ? 2 : 4;
  const [whole, part] = value.toFixed(digits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${part ? `,${part}` : ""} ${SYMBOL[unit] ?? unit}`;
}

function day(iso: string) {
  const [, month, date] = iso.split("-").map(Number);
  return `${date} ${MONTHS[month - 1] ?? ""}`;
}

/**
 * What the price did in the month before the story: a drawn line in the article's
 * own colour, the latest value and the move in words. An arrow and a sign carry the
 * direction too, so it never rests on red and green alone.
 */
export default function ArticleChart({ chart }: { chart: Chart }) {
  const shape = chartShape(chart.points, WIDTH, HEIGHT);
  const first = chart.points[0][0];
  const last = chart.points[chart.points.length - 1][0];
  const percent = Math.abs(shape.change * 100).toFixed(1).replace(".", ",");
  const up = shape.change >= 0;
  const subject = chart.label.includes("euro") ? chart.label : `${chart.label} në dollarë`;
  const summary = `${subject}: nga ${amount(shape.first, chart.unit)} më ${day(first)} në ${amount(shape.last, chart.unit)} më ${day(last)}, ${up ? "rritje" : "rënie"} ${percent}%.`;
  return (
    <figure className="ctx-chart">
      <figcaption className="ctx-chart-head">
        <span className="ctx-chart-label">{subject}</span>
        <span className="ctx-chart-now">
          <strong>{amount(shape.last, chart.unit)}</strong>
          <span className={up ? "ctx-chart-up" : "ctx-chart-down"}>
            <span aria-hidden="true">{up ? "▲" : "▼"}</span> {up ? "+" : "−"}{percent}% në 30 ditë
          </span>
        </span>
      </figcaption>
      <div className="ctx-chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={summary}>
          <path d={shape.area} fill="var(--ctx-accent)" opacity="0.09" />
          <path d={shape.line} fill="none" stroke="var(--ctx-accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="ctx-chart-dot" style={{ top: `${(shape.lastY / HEIGHT) * 100}%` }} aria-hidden="true" />
        <span className="ctx-chart-scale" aria-hidden="true">
          <span>{amount(shape.high, chart.unit)}</span>
          <span>{amount(shape.low, chart.unit)}</span>
        </span>
      </div>
      <div className="ctx-chart-foot">
        <span aria-hidden="true">{day(first)}</span>
        <a className="ctx-media-source" href={chart.sourceUrl} target="_blank" rel="noopener noreferrer">Të dhënat: {chart.source}</a>
        <span aria-hidden="true">{day(last)}</span>
      </div>
    </figure>
  );
}
