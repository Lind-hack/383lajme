import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import ArticleContent from "@/components/article-content";
import type { Article } from "@/lib/mock-data";
import { readBotaArticle } from "@/lib/bota-store.mjs";
import { getCategoryColor, getCategoryBg } from "@/lib/category-colors";
import { probeImageSize } from "@/lib/image-size.mjs";
import { ToneTag } from "../../stories";
import s from "./reader.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await readBotaArticle(id);
  if (!article) return {};
  return { title: article?.albanianTitle ?? article?.title ?? "Bota për Kosovën", description: article?.blurb ?? undefined,
    alternates: { canonical: `https://www.383ks.com/bota-per-kosoven/artikull/${id}` } };
}

export default async function TranslatedArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publication = await readBotaArticle(id);
  if (!publication) notFound();
  // A stored row is JSON written by whichever pipeline version saved it, so
  // every field is read defensively: an older row without paragraphs or an
  // outlet still renders instead of throwing.
  const paragraphs: string[] = Array.isArray(publication?.paragraphs)
    ? publication.paragraphs.filter((p: unknown): p is string => typeof p === "string")
    : [];
  const outlet: string = publication?.outlet ?? "";
  const country: string = publication?.country ?? "";
  const date: string = publication?.date ?? "";
  const title: string = publication?.albanianTitle ?? publication?.title ?? "";
  const blurb: string = publication?.blurb ?? "";
  const reason: string = publication?.reason ?? "";
  const sentiment: "positive" | "neutral" | "negative" = ["positive", "neutral", "negative"].includes(publication?.sentiment)
    ? publication.sentiment
    : "neutral";
  const heroSize = await probeImageSize(publication?.imageUrl);
  const article: Article = {
    id, slug: id, dispatch: "", title,
    excerpt: blurb, body: paragraphs.join("\n\n"),
    source: outlet, sourceFlag: publication?.flag ?? "",
    sourceBias: "neutral", tone: sentiment, category: "Botë",
    publishedAt: date ? `${date}T00:00:00Z` : "", readingTime: 0, featured: false,
    imageUrl: publication?.imageUrl || undefined,
    imageWidth: heroSize?.width, imageHeight: heroSize?.height,
  };
  const meta = [country, outlet].filter(Boolean).join(" · ");
  const source = publication?.url
    ? <a className={s.source} href={publication.url} target="_blank" rel="noopener noreferrer">{outlet ? `Lexo burimin: ${outlet}` : "Lexo burimin origjinal"} <span aria-hidden>↗</span></a>
    : null;
  return <><TextureBg /><Navbar />
    <ArticleContent article={article} related={[]} categorySlides={[]} dosje={null}
      catColor={getCategoryColor("Botë")} catBg={getCategoryBg("Botë", 0.08)}
      editorial={{
        path: `/bota-per-kosoven/artikull/${id}`,
        metadata: <div className={s.meta}>{meta && <span>{meta}</span>}{date && <time dateTime={date}>{date}</time>}<span>Përkthyer në shqip</span><ToneTag tone={sentiment} /></div>,
        afterBody: <aside className={s.assessment}>
          <h2>Si e portretizon artikulli Kosovën?</h2>
          <ToneTag tone={sentiment} />{reason && <p>{reason}</p>}
          <p>Vlerësojmë mënyrën si shkruhet për Kosovën, jo nëse ngjarja është e mirë apo e keqe.</p>
          {publication?.title && <p className={s.original}>Titulli origjinal: {publication.title}</p>}
          {source}<br /><Link className={s.back} href="/bota-per-kosoven">← Kthehu te Bota për Kosovën</Link>
        </aside>,
        sidebar: <aside className={s.sidebar}><h2>Nga shtypi i huaj</h2>{meta && <p>{meta}</p>}<ToneTag tone={sentiment} />{reason && <p>{reason}</p>}{source}<br /><Link className={s.back} href="/bota-per-kosoven">Të gjitha lajmet e botës</Link></aside>,
      }} />
    <Footer /></>;
}
