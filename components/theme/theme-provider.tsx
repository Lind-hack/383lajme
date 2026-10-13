"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_KEY, THEME_COOKIE, normalizeTheme, type SiteTheme } from "@/lib/site-theme.mjs";
const ThemeContext = createContext<{theme:SiteTheme;selectTheme:(theme:SiteTheme)=>void}>({theme:"light",selectTheme:()=>{}});
export function useTheme(){return useContext(ThemeContext);}
function applyTheme(theme:SiteTheme){
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#151513":"#F9F6F1");
}
export default function ThemeProvider({children}:{children:ReactNode}){
  const [theme,setTheme]=useState<SiteTheme>("light");
  useEffect(()=>{
    const initial=normalizeTheme(document.documentElement.dataset.theme);setTheme(initial);applyTheme(initial);
    const onStorage=(event:StorageEvent)=>{if(event.key===THEME_KEY){const next=normalizeTheme(event.newValue);setTheme(next);applyTheme(next);document.cookie=`${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;}};
    window.addEventListener("storage",onStorage);return()=>window.removeEventListener("storage",onStorage);
  },[]);
  const selectTheme=(next:SiteTheme)=>{setTheme(next);applyTheme(next);try{localStorage.setItem(THEME_KEY,next);}catch{}document.cookie=`${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;};
  return <ThemeContext.Provider value={{theme,selectTheme}}>{children}</ThemeContext.Provider>;
}
