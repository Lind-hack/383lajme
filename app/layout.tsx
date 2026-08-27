import type { Metadata } from "next";
import { Manrope, Figtree, EB_Garamond } from "next/font/google";
import "./globals.css";
import SignupPrompt from "@/components/signup-prompt";
import MotionProvider from "@/components/motion-provider";
import Ga from "@/components/analytics/ga";

// The dossier is set in a serif: it is the record behind the news rather than
// the news, and design 3a leans on that register throughout — the topic title,
// every entry title, and the italic notes.
const ebGaramond = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-garamond",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Softer, rounder terminals than Manrope for the nav category links,
// while staying a serious grotesque rather than a playful display face.
// latin-ext covers ë/ç.
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
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
    <html lang="sq" className={`${manrope.variable} ${figtree.variable} ${ebGaramond.variable}`} style={{ background: "#F9F6F1" }}>
      <head>
        <meta name="theme-color" content="#F9F6F1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body style={{ fontFamily: "var(--font-manrope), sans-serif", background: "#F9F6F1" }}>
        <MotionProvider>
          {children}
          <SignupPrompt />
          <Ga />
        </MotionProvider>
      </body>
    </html>
  );
}
