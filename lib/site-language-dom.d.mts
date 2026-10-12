export type TranslationSlot = {read:()=>string;write:(value:string)=>void;connected:()=>boolean;sourceLanguage:string;source:string;rendered:string;target?:Node};
export const TRANSLATION_EXCLUDED:string;
export const TRANSLATED_ATTRIBUTES:string[];
export function captureTranslationSlot(read:()=>string,write:(value:string)=>void,connected:()=>boolean,sourceLanguage?:string):TranslationSlot;
export function refreshTranslationSlot(slot:TranslationSlot):string;
export function applyTranslationSlot(slot:TranslationSlot,source:string,translation:string):boolean;
export function splitTranslationText(text:string,maximum?:number):string[];
export function translationBatches(texts:string[],countLimit?:number,characterLimit?:number):string[][];
