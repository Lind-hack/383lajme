"use client";

import Link from "next/link";
import { XHEP_LANG_COOKIE, xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import styles from "./lang-toggle.module.css";

/**
 * EN / SQ switch. Plain links to ?lang= so it works before hydration and
 * gives crawlers both versions; the click also remembers the choice.
 */
export default function LangToggle({ lang }: { lang: XhepLang }) {
  const t = xhepDict(lang).toggle;
  const remember = (next: XhepLang) => {
    document.cookie = `${XHEP_LANG_COOKIE}=${next}; path=/visit; max-age=31536000; samesite=lax`;
  };
  return (
    <nav className={styles.toggle} aria-label={t.label}>
      {(["en", "sq"] as const).map((option) => (
        <Link
          key={option}
          href={`/visit?lang=${option}`}
          hrefLang={option}
          lang={option}
          aria-current={option === lang ? "true" : undefined}
          className={option === lang ? styles.active : undefined}
          onClick={() => remember(option)}
          scroll={false}
        >
          {t[option]}
        </Link>
      ))}
    </nav>
  );
}
