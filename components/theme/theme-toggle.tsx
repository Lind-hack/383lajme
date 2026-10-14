"use client";
import { Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
export default function ThemeToggle(){
 const {theme,selectTheme}=useTheme();
 return <div className="theme-setting"><div><strong><Moon size={16} aria-hidden="true"/> Modaliteti i errët</strong><p>Pamja ruhet në këtë pajisje.</p></div><button type="button" role="switch" aria-checked={theme==="dark"} aria-label="Modaliteti i errët" onClick={()=>selectTheme(theme==="dark"?"light":"dark")}><span/></button></div>;
}
