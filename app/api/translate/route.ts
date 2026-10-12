import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LANGUAGE_CACHE_VERSION, localTranslation, validateTranslationRequest, type SiteLanguage } from "@/lib/site-language.mjs";
import { translateSiteTexts } from "@/lib/site-translation-provider.mjs";

export const runtime = "nodejs";
const cache = new Map<string,string>();
const pending = new Map<string,Promise<string[]>>();
const requests = new Map<string,{started:number;count:number}>();
const hash = (text:string, language:SiteLanguage) => createHash("sha256").update(`${LANGUAGE_CACHE_VERSION}\0${language}\0${text}`).digest("hex");
function remember(key:string,value:string) {
  cache.set(key,value);
  if(cache.size>20000) cache.delete(cache.keys().next().value!);
}

export async function POST(request:NextRequest) {
  const origin=request.headers.get("origin");
  if(origin && origin !== request.nextUrl.origin) return NextResponse.json({error:"Invalid origin."},{status:403});
  if(Number(request.headers.get("content-length")??0)>50000) return NextResponse.json({error:"Request too large."},{status:413});
  const reader=request.body?.getReader();
  if(!reader) return NextResponse.json({error:"Invalid translation request."},{status:400});
  const decoder=new TextDecoder();
  let raw="",bytes=0;
  while(true) {
    const chunk=await reader.read();
    if(chunk.done) break;
    bytes+=chunk.value.byteLength;
    if(bytes>50000) {await reader.cancel();return NextResponse.json({error:"Request too large."},{status:413});}
    raw+=decoder.decode(chunk.value,{stream:true});
  }
  raw+=decoder.decode();
  let input:{language:SiteLanguage;texts:string[]};
  try {input=validateTranslationRequest(JSON.parse(raw));}
  catch {return NextResponse.json({error:"Invalid translation request."},{status:400});}
  const {language,texts}=input;
  const keys=texts.map(text=>hash(text,language));
  const results=texts.map((text,index)=>localTranslation(text,language,"auto")??cache.get(keys[index])??null);
  const admin=createAdminClient();
  const missingKeys=keys.filter((_,index)=>results[index]===null);
  if(missingKeys.length && admin) {
    try {
      const {data}=await admin.from("site_translation_cache").select("cache_key,translated_text").in("cache_key",missingKeys).abortSignal(AbortSignal.timeout(1000));
      for(const row of data??[]) remember(row.cache_key,row.translated_text);
    } catch { /* A cache outage must not disable live translation. */ }
    results.forEach((_,index)=>{if(results[index]===null) results[index]=cache.get(keys[index])??null;});
  }
  const missing=[...new Set(texts.filter((_,index)=>results[index]===null))];
  if(missing.length) {
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
    const now=Date.now();
    const recent=requests.get(ip);
    const budget=recent && now-recent.started<300000?recent:{started:now,count:0};
    budget.count++; requests.set(ip,budget);
    if(requests.size>4000) requests.delete(requests.keys().next().value!);
    if(budget.count>90) return NextResponse.json({error:"Please retry shortly."},{status:429,headers:{"Retry-After":"60"}});
    const batchKey=hash(JSON.stringify(missing),language);
    let job=pending.get(batchKey);
    if(!job) {
      if(pending.size>=6) return NextResponse.json({error:"Translation is busy. Please retry."},{status:503,headers:{"Retry-After":"2"}});
      job=translateSiteTexts(missing,language);
      pending.set(batchKey,job);
    }
    try {
      const translated=await job;
      const rows=missing.map((text,index)=>({cache_key:hash(text,language),language,translated_text:translated[index]}));
      for(const row of rows) remember(row.cache_key,row.translated_text);
      if(admin) try {await admin.from("site_translation_cache").upsert(rows,{onConflict:"cache_key"}).abortSignal(AbortSignal.timeout(1000));} catch { /* Memory/browser caches remain available. */ }
      results.forEach((_,index)=>{if(results[index]===null) results[index]=cache.get(keys[index])??null;});
    } catch(error) {
      console.warn("[site-translation] generation failed",(error as {failures?:string[]}).failures?.join(",")??"unavailable");
      return NextResponse.json({error:"Translation is temporarily unavailable. Original text is preserved."},{status:503});
    } finally {if(pending.get(batchKey)===job) pending.delete(batchKey);}
  }
  return NextResponse.json({language,translations:results},{headers:{"Cache-Control":"private, max-age=86400"}});
}
