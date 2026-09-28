import { NextResponse } from "next/server";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Distinct, owned fallback when no verified subject portrait or logo exists. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const words = decodeURIComponent(slug).replace(/[^\p{L}\p{N}-]/gu, "-").split("-")
    .filter(Boolean).filter((word) => !/^20\d{2}$/.test(word) && !/^\d+$/.test(word));
  const subject = (words.slice(0, 4).join(" ") || "383 Tregu").slice(0, 42);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "383";
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const palettes = [
    ["#12382f", "#d5f1dc", "#ff8b61"], ["#292d50", "#dce2fa", "#f0b96f"],
    ["#503221", "#f5e4d2", "#fb7554"], ["#303e48", "#d8eced", "#f4ae5e"],
  ];
  const [background, foreground, accent] = palettes[hash % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="Grafikë për ${escapeXml(subject)}"><rect width="1200" height="675" fill="${background}"/><path d="M0 522 Q245 420 442 487 T871 353 T1200 318 V675 H0Z" fill="${accent}" opacity=".19"/><path d="M0 575 Q338 530 584 581 T1200 472" fill="none" stroke="${accent}" stroke-width="9" opacity=".85"/><text x="78" y="100" font-family="Arial,sans-serif" font-size="36" font-weight="800" letter-spacing="7" fill="${accent}">383 TREGU</text><text x="75" y="374" font-family="Arial,sans-serif" font-size="245" font-weight="800" fill="${foreground}">${escapeXml(initials)}</text><line x1="78" y1="453" x2="1122" y2="453" stroke="${foreground}" opacity=".45" stroke-width="2"/><text x="78" y="531" font-family="Arial,sans-serif" font-size="57" font-weight="700" fill="${foreground}">${escapeXml(subject)}</text><text x="80" y="607" font-family="Arial,sans-serif" font-size="26" fill="${foreground}" opacity=".8">Pyetja ka identitetin e vet · PO / JO</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
}
