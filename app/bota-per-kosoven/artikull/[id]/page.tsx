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
  return { title: article.albanianTitle, description: article.blurb,
    alternates: { canonical: `https://www.383ks.com/bota-per-kosoven/artikull/${id}` } };
}

export default async function TranslatedArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publication = await readBotaArticle(id);
  if (!publication) notFound();
  const heroSize = await probeImageSize(publication.imageUrl);
  const article: Article = {
    id, slug: id, dispatch: "", title: publication.albanianTitle,
    excerpt: publication.blurb, body: publication.paragraphs.join("\n\n"),
    source: publication.outlet, sourceFlag: publication.flag ?? "",
    sourceBias: "neutral", tone: publication.sentiment, category: "Botë",
    publishedAt: `${publication.date}T00:00:00Z`, readingTime: 0, featured: false,
    imageUrl: publication.imageUrl || undefined,
    imageWidth: heroSize?.width, imageHeight: heroSize?.height,
  };
  const source = <a className={s.source} href={publication.url} target="_blank" rel="noopener noreferrer">Lexo burimin: {publication.outlet} <span aria-hidden>↗</span></a>;
  return <><TextureBg /><Navbar />
    <ArticleContent article={article} related={[]} categorySlides={[]} dosje={null}
      catColor={getCategoryColor("Botë")} catBg={getCategoryBg("Botë", 0.08)}
      editorial={{
        path: `/bota-per-kosoven/artikull/${id}`,
        metadata: <div className={s.meta}><span>{publication.country} · {publication.outlet}</span><time dateTime={publication.date}>{publication.date}</time><span>Përkthyer në shqip</span><ToneTag tone={publication.sentiment} /></div>,
        afterBody: <aside className={s.assessment}>
          <h2>Si e portretizon artikulli Kosovën?</h2>
          <ToneTag tone={publication.sentiment} /><p>{publication.reason}</p>
          <p>Vlerësojmë mënyrën si shkruhet për Kosovën, jo nëse ngjarja është e mirë apo e keqe.</p>
          <p className={s.original}>Titulli origjinal: {publication.title}</p>
          {source}<br /><Link className={s.back} href="/bota-per-kosoven">← Kthehu te Bota për Kosovën</Link>
        </aside>,
        sidebar: <aside className={s.sidebar}><h2>Nga shtypi i huaj</h2><p>{publication.country} · {publication.outlet}</p><ToneTag tone={publication.sentiment} /><p>{publication.reason}</p>{source}<br /><Link className={s.back} href="/bota-per-kosoven">Të gjitha lajmet e botës</Link></aside>,
      }} />
    <Footer /></>;
}
