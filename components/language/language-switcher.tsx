"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { SITE_LANGUAGES } from "@/lib/site-language.mjs";
import { useLanguage } from "./language-provider";
const names={sq:"Shqip",en:"English",de:"Deutsch"};
const copy={sq:{label:"Gjuha",loading:"Duke përkthyer…",error:"Disa tekste nuk u përkthyen. Provo përsëri.",note:"Përkthim automatik; shqipja është origjinali."},en:{label:"Language",loading:"Translating…",error:"Some text could not be translated. Try again.",note:"Automatic translation; Albanian is the original."},de:{label:"Sprache",loading:"Wird übersetzt…",error:"Einige Texte konnten nicht übersetzt werden. Erneut versuchen.",note:"Automatische Übersetzung; Albanisch ist das Original."}};
/**
 * In the header on a phone the three-way SQ/EN/DE control took three slots of
 * a row that also holds the logo, search, Pyet Dardanin and the menu, with
 * 24px targets and 9px text. There it becomes one chip that opens the three
 * choices (CSS swaps the two at 640px). Desktop and the inline uses keep the row.
 */
export default function LanguageSwitcher({inline=false}:{inline?:boolean}) {
  const {language,status,selectLanguage}=useLanguage();const text=copy[language];
  const [open,setOpen]=useState(false);
  const chipRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const onDown=(e:PointerEvent)=>{if(!chipRef.current?.contains(e.target as Node))setOpen(false);};
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);(chipRef.current?.querySelector(".site-language-chip") as HTMLButtonElement|null)?.focus();}};
    document.addEventListener("pointerdown",onDown);document.addEventListener("keydown",onKey);
    // A disclosure: opening moves focus to the current choice, so a keyboard reader lands in the list.
    (chipRef.current?.querySelector('.site-language-menu button[aria-pressed="true"]') as HTMLButtonElement|null)?.focus();
    return()=>{document.removeEventListener("pointerdown",onDown);document.removeEventListener("keydown",onKey);};
  },[open]);
  return <div className={`site-language ${inline?"site-language-inline":"site-language-header"}`} data-no-translate translate="no">
    <div className="site-language-options" role="group" aria-label={text.label}>
      {SITE_LANGUAGES.map(option=><button key={option} type="button" lang={option} aria-label={names[option]} aria-pressed={language===option} onClick={()=>selectLanguage(option)} title={names[option]}>{option.toUpperCase()}</button>)}
    </div>
    {!inline&&<div className="site-language-compact" ref={chipRef} onBlur={e=>{if(open&&!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}}>
      <button type="button" className="site-language-chip" aria-expanded={open} aria-controls="site-language-menu" aria-label={`${language.toUpperCase()}, ${text.label}: ${names[language]}`} onClick={()=>setOpen(v=>!v)}>
        {language.toUpperCase()}<ChevronDown size={13} strokeWidth={2.6} aria-hidden="true"/>
      </button>
      {open&&<div id="site-language-menu" className="site-language-menu" role="group" aria-label={text.label}>
        {SITE_LANGUAGES.map(option=><button key={option} type="button" lang={option} aria-pressed={language===option} onClick={()=>{selectLanguage(option);setOpen(false);}}>
          <span>{names[option]}</span>{language===option&&<Check size={15} strokeWidth={2.6} aria-hidden="true"/>}
        </button>)}
      </div>}
    </div>}
    <span className={`site-language-state ${status}`} role="status" aria-live="polite" title={status==="error"?text.error:text.note}>
      {status==="loading"?<><i aria-hidden="true"/><span className="sr-only">{text.loading}</span></>:status==="error"?<button type="button" onClick={()=>selectLanguage(language)} aria-label={text.error}>!</button>:null}
    </span>
  </div>;
}
