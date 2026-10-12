import type { SiteLanguage } from "./site-language.mjs";
export function translateSiteTexts(texts: string[], language: SiteLanguage, options?: {env?: Record<string,string | undefined>; fetchImpl?: typeof fetch; signal?: AbortSignal}): Promise<string[]>;
