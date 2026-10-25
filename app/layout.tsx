import type { Metadata } from "next";
import { jsonLdString } from "@/lib/json-ld";
import localFont from "next/font/local";
import "./globals.css";
import "./site-theme.css";
import ThemeProvider from "@/components/theme/theme-provider";
import { themeBootstrap } from "@/lib/site-theme.mjs";
import MotionProvider from "@/components/motion-provider";
import Ga from "@/components/analytics/ga";
import MobileTabBar from "@/components/mobile-tab-bar";
import PageLoader from "@/components/dardani/page-loader";
import LedgerVisit from "@/components/ledger-visit";
import LanguageProvider from "@/components/language/language-provider";

// The dossier is set in a serif: it is the record behind the news rather than
// the news, and design 3a leans on that register throughout — the topic title,
// every entry title, and the italic notes.
// Same font revision as the Google files, with all original-language glyphs.
// Load the dossier face when used instead of preloading both full font files.
const ebGaramond = localFont({
  src: [
    { path: "../public/fonts/EBGaramond-variable-normal.woff2", weight: "400 600", style: "normal" },
    { path: "../public/fonts/EBGaramond-variable-italic.woff2", weight: "400 600", style: "italic" },
  ],
  preload: false,
  adjustFontFallback: "Times New Roman",
  display: "swap",
  variable: "--font-garamond",
});

// Keep Manrope's existing multilingual subsets and preloads. A missing
// latin-ext preload previously caused a measured 0.595 mobile layout shift.
// Every bundled file carries the 200–800 axis.
const manrope = localFont({
  src: [
    { path: "../public/fonts/Manrope-subset-1.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/Manrope-subset-2.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/Manrope-subset-3.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/Manrope-subset-4.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/Manrope-latin-ext.woff2", weight: "200 800", style: "normal" },
    { path: "../public/fonts/Manrope-latin.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

// Softer, rounder terminals than Manrope for the nav category links,
// while staying a serious grotesque rather than a playful display face.
// latin-ext covers ë/ç.
const figtree = localFont({
  src: "../public/fonts/Figtree-variable-normal.woff2",
  weight: "500 700",
  style: "normal",
  variable: "--font-figtree",
  display: "swap",
});

const SITE_DESCRIPTION =
  "383 — lajme origjinale nga Kosova dhe bota, analiza se si mediat botërore flasin për Kosovën, dhe Tregu 383 ku parashikon ngjarjet, fiton monedha dhe garon me të tjerët. Platformë e vetme e këtij lloji në Kosovë.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.383ks.com"),
  title: {
    default: "383",
    template: "%s — 383",
  },
  description: SITE_DESCRIPTION,
  keywords: ["Kosovë", "lajme", "news", "Kosovo", "albanians", "383", "tregu", "parashikime"],
  openGraph: {
    title: "383",
    description: SITE_DESCRIPTION,
    type: "website",
    url: "https://www.383ks.com",
    siteName: "383",
    images: ["/logo-512.png"],
  },
  // Opened from an iPhone home screen, 383 runs as its own app — the only way
  // Apple lets a website send notifications (see app/manifest.ts).
  appleWebApp: { capable: true, title: "383", statusBarStyle: "default" },
};

// Google reads this to pair the site name "383" and the logo with search
// results for the domain.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NewsMediaOrganization",
      name: "383",
      url: "https://www.383ks.com",
      logo: "https://www.383ks.com/logo-512.png",
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      name: "383",
      alternateName: "383 Lajme",
      url: "https://www.383ks.com",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="sq"
      suppressHydrationWarning
      className={`${manrope.variable} ${figtree.variable} ${ebGaramond.variable}`}
      style={{ background: "#F9F6F1" }}
    >
      <head>
        <meta name="theme-color" content="#F9F6F1" />
        <script dangerouslySetInnerHTML={{__html:themeBootstrap}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(structuredData) }}
        />
      </head>
      <body style={{ fontFamily: "var(--font-manrope), sans-serif", background: "#F9F6F1" }}>
        <ThemeProvider><LanguageProvider><MotionProvider>
          <PageLoader />
          {children}
          {/* In the layout, not the navbar, so it survives navigation and its
              highlight can slide from one tab to the next. */}
          <MobileTabBar />
          <LedgerVisit />
          <Ga />
        </MotionProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
