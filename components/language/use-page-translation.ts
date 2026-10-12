"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { localTranslation, LANGUAGE_CACHE_VERSION, type SiteLanguage } from "@/lib/site-language.mjs";
import { TRANSLATION_EXCLUDED, TRANSLATED_ATTRIBUTES, captureTranslationSlot, refreshTranslationSlot, applyTranslationSlot, splitTranslationText, translationBatches, type TranslationSlot } from "@/lib/site-language-dom.mjs";

export type TranslationStatus = "ready" | "loading" | "error";
const cacheKey="383-translations-"+LANGUAGE_CACHE_VERSION;
export function usePageTranslation(language:SiteLanguage,retry:number,report:(status:TranslationStatus)=>void) {
  const pathname=usePathname();
  const slots=useRef(new Set<TranslationSlot>());
  const nodeSlots=useRef(new WeakMap<Node,Map<string,TranslationSlot>>());
  const cache=useRef(new Map<string,string>());
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(cacheKey)??"[]");
      if(Array.isArray(saved)) for(const entry of saved.slice(-2000)) if(Array.isArray(entry)&&typeof entry[0]==="string"&&typeof entry[1]==="string") cache.current.set(entry[0],entry[1]);
    } catch { /* Storage restrictions do not disable the switcher. */ }
  },[]);
  useEffect(()=>{
    const blocked=/^\/admin(?:\/|$)/.test(pathname??"");
    document.documentElement.lang=blocked?"sq":language;
    const controller=new AbortController(),failed=new Set<string>();
    let timer:ReturnType<typeof setTimeout>|undefined,running=false,dirty=false;
    const key=(text:string)=>`${language}\0${text}`;
    const excluded=(element:Element|null)=>!element||Boolean(element.closest(TRANSLATION_EXCLUDED));
    const sourceLanguage=(element:Element)=>{
      const source=element.closest("[data-source-language]");
      if(source) return source.getAttribute("data-source-language")??"sq";
      const declared=element.closest("[lang]");
      if(!declared||declared===document.documentElement) return "sq";
      return declared.getAttribute("lang")??"sq";
    };
    const capture=(node:Node,attribute:string,read:()=>string,write:(value:string)=>void,lang:string)=>{
      let entries=nodeSlots.current.get(node);
      if(!entries) {entries=new Map();nodeSlots.current.set(node,entries);}
      let slot=entries.get(attribute);
      if(!slot) {slot=captureTranslationSlot(read,write,()=>node.isConnected,lang);entries.set(attribute,slot);slots.current.add(slot);}
      slot.sourceLanguage=lang;
      slot.target=node;
      slots.current.add(slot);
      refreshTranslationSlot(slot);
    };
    const collect=()=>{
      const title=document.querySelector("title")?.firstChild;
      if(title?.nodeType===Node.TEXT_NODE && !/^\/visit\/(r|t)(\/|$)/.test(pathname??"")) capture(title,"text",()=>title.nodeValue??"",value=>{title.nodeValue=value;},"sq");
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const node=walker.currentNode as Text;
        if(excluded(node.parentElement)||!node.data.trim()||node.data.trim().length<2) continue;
        capture(node,"text",()=>node.data,value=>{node.data=value;},sourceLanguage(node.parentElement!));
      }
      for(const element of document.body.querySelectorAll("[aria-label],[placeholder],[title],img[alt]")) {
        if(element.closest(TRANSLATION_EXCLUDED.replace("textarea,",""))) continue;
        for(const attribute of TRANSLATED_ATTRIBUTES) if(element.getAttribute(attribute)?.trim()) capture(element,attribute,()=>element.getAttribute(attribute)??"",value=>element.setAttribute(attribute,value),sourceLanguage(element));
      }
      for(const slot of slots.current) {
        const element=slot.target?.nodeType===Node.ELEMENT_NODE?slot.target as Element:slot.target?.parentElement;
        const excludedSlot=element?.closest(slot.target?.nodeType===Node.ELEMENT_NODE?TRANSLATION_EXCLUDED.replace("textarea,",""):TRANSLATION_EXCLUDED);
        const privateTitle=element?.tagName==="TITLE" && /^\/visit\/(r|t)(\/|$)/.test(pathname??"");
        if(!slot.connected()||excludedSlot||privateTitle) slots.current.delete(slot);
      }
      for(const element of document.body.querySelectorAll<HTMLElement>("[data-source-language]")) element.lang=language;
    };
    const resolve=(text:string,source:string)=>localTranslation(text,language,source)??cache.current.get(key(text))??null;
    const apply=()=>{
      observer.disconnect();
      for(const slot of slots.current) {
        const original=refreshTranslationSlot(slot),parts=splitTranslationText(original);
        const values=parts.map(part=>resolve(part.trim(),slot.sourceLanguage));
        if(values.every(value=>value!==null)) {
          const translated=values.map((value,index)=>`${parts[index].match(/^\s*/)?.[0]??""}${value}${parts[index].match(/\s*$/)?.[0]??""}`).join("");
          applyTranslationSlot(slot,original,translated.trim());
        } else if(slot.rendered!==original) applyTranslationSlot(slot,original,original.trim());
      }
      if(!controller.signal.aborted) observe();
    };
    const save=()=>{
      if(cache.current.size>4000) for(const old of [...cache.current.keys()].slice(0,cache.current.size-4000)) cache.current.delete(old);
      try {
        const entries=[...cache.current].slice(-2000);
        while(entries.length&&JSON.stringify(entries).length>350000) entries.shift();
        localStorage.setItem(cacheKey,JSON.stringify(entries));
      } catch { /* In-memory and shared caches remain usable. */ }
    };
    const run=async()=>{
      if(controller.signal.aborted||blocked) return;
      if(running) {dirty=true;return;}
      running=true;dirty=false;collect();apply();
      const pending=new Set<string>();
      const priority=new WeakMap<Element,number>();
      const rank=(slot:TranslationSlot)=>{
        const element=slot.target?.nodeType===Node.ELEMENT_NODE?slot.target as Element:slot.target?.parentElement;
        if(!element) return 1;
        if(!priority.has(element)) {const rect=element.getBoundingClientRect();priority.set(element,rect.bottom>0&&rect.top<window.innerHeight?0:1);}
        return priority.get(element)!;
      };
      for(const slot of [...slots.current].sort((a,b)=>rank(a)-rank(b))) for(const part of splitTranslationText(slot.source)) {
        const text=part.trim();
        if(text&&resolve(text,slot.sourceLanguage)===null&&!failed.has(text)) pending.add(text);
      }
      const queue=translationBatches([...pending]);
      if(queue.length) report("loading");
      await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
        while(queue.length&&!controller.signal.aborted) {
          const texts=queue.shift()!;
          try {
            const requestBatch=()=>fetch("/api/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language,texts}),signal:controller.signal});
            let response=await requestBatch();
            if(response.status===503&&response.headers.has("Retry-After")) {
              await new Promise(resolve=>setTimeout(resolve,1500));
              if(controller.signal.aborted) return;
              response=await requestBatch();
            }
            if(!response.ok) throw new Error("Translation unavailable");
            const data=await response.json();
            if(data.language!==language||!Array.isArray(data.translations)||data.translations.length!==texts.length||data.translations.some((value:unknown)=>typeof value!=="string"||!value.trim())) throw new Error("Incomplete translation");
            if(controller.signal.aborted) return;
            texts.forEach((text,index)=>cache.current.set(key(text),data.translations[index]));apply();
          } catch {if(!controller.signal.aborted) for(const text of texts) failed.add(text);}
        }
      }));
      if(controller.signal.aborted) return;
      save();report(failed.size?"error":"ready");running=false;
      if(dirty) schedule();
    };
    const schedule=()=>{if(timer) clearTimeout(timer);timer=setTimeout(()=>{void run();},60);};
    const observer=new MutationObserver(records=>{
      if(records.some(record=>record.attributeName==="data-no-translate"||!excluded(record.target.nodeType===Node.ELEMENT_NODE?record.target as Element:record.target.parentElement))) schedule();
    });
    const observe=()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...TRANSLATED_ATTRIBUTES,"data-no-translate","data-source-language"]});
    if(blocked) {for(const slot of slots.current) applyTranslationSlot(slot,slot.source,slot.source.trim());report("ready");}
    else {observe();void run();}
    return()=>{controller.abort();observer.disconnect();if(timer) clearTimeout(timer);};
  },[language,pathname,retry,report]);
}
