// The closing band: what 383 is, in four measured facts, and one invitation.
//
// Every number here is either counted from the page's own data or is a plain
// statement of how the product works. None of them is a marketing claim, and
// none is rounded up to sound better:
//
//   - sources      counted from the articles actually on this page
//   - articles     the size of the pool the page was built from
//   - updates      the collection cadence, which is a fact about the pipeline
//   - diaspora     a description, not a metric — so it carries no number
//
// PRODUCT.md's evidence section ends with "Future work must not fabricate
// them", and a stats bar is exactly where fabrication usually starts. If a
// figure cannot be counted, it does not appear.

import Link from "next/link";
import { Globe2, Newspaper, RefreshCw, Users } from "lucide-react";

export default function TrustBar({
  sourceCount,
  articleCount,
}: {
  sourceCount: number;
  articleCount: number;
}) {
  const stats = [
    {
      icon: Globe2,
      value: sourceCount > 0 ? `${sourceCount}` : "—",
      label: "Burime në përmbledhje",
    },
    {
      icon: Newspaper,
      value: articleCount > 0 ? `${articleCount}` : "—",
      label: "Lajme në përmbledhje",
    },
    { icon: RefreshCw, value: "24/7", label: "Përditësime" },
    { icon: Users, value: "Diaspora", label: "Vegla për vizitorët" },
  ];

  return (
    <section className="home-trust" aria-label="Për 383">
      <div className="home-trust-stats">
        {stats.map((s) => (
          <div key={s.label} className="home-trust-stat">
            <span className="home-trust-icon" aria-hidden="true">
              <s.icon size={18} strokeWidth={2.2} />
            </span>
            <span className="home-trust-value">{s.value}</span>
            <span className="home-trust-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="home-trust-cta">
        <div>
          <strong>Bëhu pjesë e 383</strong>
          <span>Pa pagesë. Zgjedhjet e tua ruhen në pajisjen tënde.</span>
        </div>
        <Link href="/hyr?tab=regjistrohu">
          Regjistrohu falas <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
