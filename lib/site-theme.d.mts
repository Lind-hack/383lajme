export type SiteTheme = "light" | "dark";
export const THEME_KEY: string;
export const THEME_COOKIE: string;
export function normalizeTheme(value: unknown): SiteTheme;
export const themeBootstrap: string;
