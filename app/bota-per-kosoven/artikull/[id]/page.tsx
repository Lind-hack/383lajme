import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TextureBg from "@/components/aurora-bg";
import { readBotaArticle } from "@/lib/bota-store.mjs";
import { ToneTag } from "../../stories";
import ReadingTools from "../../reading-tools";
import s from "./reader.module.css";

export const dynamic = "force-dynamic";

export default async function TranslatedArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await readBotaArticle(id);
  if (!article) notFound();
  const minutes = Math.max(1, Math.ceil(article.paragraphs.join(" ").split(/\s+/).length / 180));
  return <><TextureBg /><Navbar /><main className={s.reader}>
    <Link className={s.back} href="/bota-per-kosoven">← Kthehu te Bota për Kosovën</Link>
    <article>
      <p className={s.meta}>{article.country} · {article.outlet} · {article.date}</p>
      <h1>{article.albanianTitle}</h1>
      <p className={s.meta}>Përkthyer në shqip · rreth {minutes} minuta lexim</p>
      <ReadingTools title={article.albanianTitle}>
        {article.blurb && <aside className={s.summary}><h2>Me pak fjalë</h2><p>{article.blurb}</p></aside>}
        <div className={s.body}>{article.paragraphs.map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}</div>
        <aside className={s.assessment}>
          <h2>Si e portretizon artikulli Kosovën?</h2>
          <ToneTag tone={article.sentiment} /><p>{article.reason}</p>
          <p className={s.meta}>Vlerësojmë mënyrën si shkruhet për Kosovën, jo nëse ngjarja është e mirë apo e keqe.</p>
        </aside>
        <p className={s.original}>Titulli origjinal: {article.title}</p>
        <a className={s.source} href={article.url} target="_blank" rel="noopener noreferrer">Lexo burimin: {article.outlet} <span aria-hidden>↗</span></a>
      </ReadingTools>
    </article>
  </main><Footer /></>;
}
