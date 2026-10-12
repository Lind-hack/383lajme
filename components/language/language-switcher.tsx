"use client";
import { Globe2 } from "lucide-react";
import { SITE_LANGUAGES } from "@/lib/site-language.mjs";
import { useLanguage } from "./language-provider";
const names={sq:"Shqip",en:"English",de:"Deutsch"};
const copy={sq:{label:"Gjuha",loading:"Duke përkthyer…",error:"Disa tekste nuk u përkthyen. Provo përsëri.",note:"Përkthim automatik; shqipja është origjinali."},en:{label:"Language",loading:"Translating…",error:"Some text could not be translated. Try again.",note:"Automatic translation; Albanian is the original."},de:{label:"Sprache",loading:"Wird übersetzt…",error:"Einige Texte konnten nicht übersetzt werden. Erneut versuchen.",note:"Automatische Übersetzung; Albanisch ist das Original."}};
export default function LanguageSwitcher({mobile=false,inline=false}:{mobile?:boolean;inline?:boolean}) {
  const {language,status,selectLanguage}=useLanguage();const text=copy[language];
  return <div className={`site-language ${inline?"site-language-inline":mobile?"site-language-mobile":"site-language-desktop"}`} data-no-translate translate="no">
    <span className="site-language-caption"><Globe2 size={15} aria-hidden="true"/><span>{text.label}</span></span>
    <div className="site-language-options" role="group" aria-label={text.label}>
      {SITE_LANGUAGES.map(option=><button key={option} type="button" lang={option} aria-label={names[option]} aria-pressed={language===option} onClick={()=>selectLanguage(option)} title={names[option]}>{option.toUpperCase()}</button>)}
    </div>
    <span className={`site-language-state ${status}`} role="status" aria-live="polite" title={status==="error"?text.error:text.note}>
      {status==="loading"?<><i aria-hidden="true"/><span className="sr-only">{text.loading}</span></>:status==="error"?<button type="button" onClick={()=>selectLanguage(language)} aria-label={text.error}>!</button>:null}
    </span>
  </div>;
}
