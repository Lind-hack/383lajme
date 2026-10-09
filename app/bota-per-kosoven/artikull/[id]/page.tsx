import Link from 'next/link';
import {notFound} from 'next/navigation';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import TextureBg from '@/components/aurora-bg';
import {readBotaArticle} from '@/lib/bota-store.mjs';
import {ToneTag} from '../../stories';
import s from './reader.module.css';
export const dynamic='force-dynamic';
export default async function TranslatedArticle({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const a=await readBotaArticle(id);if(!a)notFound();
 return <><TextureBg/><Navbar/><main className={s.reader}><Link href='/bota-per-kosoven'>← Bota për Kosovën</Link><article><p className={s.meta}>{a.country} · {a.date}</p><h1>{a.albanianTitle}</h1><p className={s.meta}>Përkthim në shqip i artikullit origjinal · GPT-6 Luna</p><aside className={s.assessment}><ToneTag tone={a.sentiment}/><p>{a.reason}</p></aside><div className={s.body}>{a.paragraphs.map((p:string,i:number)=><p key={i}>{p}</p>)}</div><p className={s.original}>Titulli origjinal: {a.title}</p><a href={a.url} target='_blank' rel='noopener noreferrer'>Lexo artikullin origjinal ↗</a></article></main><Footer/></>;
}
