"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isSiteLanguage, LANGUAGE_STORAGE_KEY, type SiteLanguage } from "@/lib/site-language.mjs";
import { usePageTranslation, type TranslationStatus } from "./use-page-translation";
type LanguageContextValue={language:SiteLanguage;status:TranslationStatus;selectLanguage:(language:SiteLanguage)=>void};
const LanguageContext=createContext<LanguageContextValue>({language:"sq",status:"ready",selectLanguage:()=>{}});
export function useLanguage(){return useContext(LanguageContext);}
export default function LanguageProvider({children}:{children:React.ReactNode}) {
  const pathname=usePathname(),router=useRouter();
  const [language,setLanguage]=useState<SiteLanguage>("sq"),[status,setStatus]=useState<TranslationStatus>("ready"),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const cookie=document.cookie.split("; ").find(item=>item.startsWith("383_language="))?.split("=")[1];
    let saved:unknown=cookie;
    try {saved=localStorage.getItem(LANGUAGE_STORAGE_KEY)??cookie;} catch {}
    if(isSiteLanguage(saved)) setLanguage(saved);
    const sync=(event:StorageEvent)=>{if(event.key===LANGUAGE_STORAGE_KEY&&isSiteLanguage(event.newValue)) setLanguage(event.newValue);};
    window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync);
  },[]);
  const selectLanguage=useCallback((next:SiteLanguage)=>{
    setLanguage(next);setRetry(value=>value+1);
    try {localStorage.setItem(LANGUAGE_STORAGE_KEY,next);} catch {}
    document.cookie=`383_language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    if(pathname?.startsWith("/visit")) {
      const query=new URLSearchParams(window.location.search);
      query.set("lang",next==="de"?"sq":next);
      router.replace(`${pathname}?${query.toString()}`,{scroll:false});
    }
  },[pathname,router]);
  usePageTranslation(language,retry,setStatus);
  return <LanguageContext.Provider value={{language,status,selectLanguage}}>{children}</LanguageContext.Provider>;
}
