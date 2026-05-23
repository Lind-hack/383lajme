import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "383 — Lajmet e Kosovës",
  description: "Bota flet për Kosovën. Lajmet kryesore nga burimet ndërkombëtare, të përkthyera dhe analizuara.",
  keywords: ["Kosovë", "lajme", "news", "Kosovo", "albanians", "383"],
  openGraph: {
    title: "383 — Lajmet e Kosovës",
    description: "Bota flet për Kosovën.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={manrope.variable} style={{ background: "#F9F6F1" }}>
      <head>
        <meta name="theme-color" content="#F9F6F1" />
      </head>
      <body style={{ fontFamily: "var(--font-manrope), sans-serif", background: "#F9F6F1" }}>
        {children}
      </body>
    </html>
  );
}
